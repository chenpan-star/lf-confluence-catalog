import { useMemo, useState } from 'react';
import { buildBundledReviewMailto, guessEmail } from '../lib/contact';
import { canAutoSendSlack, dispatchRemind, isRemindTrackConfigured, slackRemindAccepted, slackRemindDelivered } from '../lib/remindTrack';
import {
  buildBundledReviewMessage,
  guessSlackHandle,
  openBundledSlackReview,
  REMIND_PAGES_PER_MESSAGE,
  resolveSlackRecipient,
  splitReminderPageChunks,
} from '../lib/slack';
import './ReviewMessageModal.css';
import './HygieneHelp.css';
import { useCatalog } from '../context/CatalogContext';

export default function ReviewMessageModal({
  editor,
  pages,
  site,
  slackConfig,
  onClose,
}) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [copiedPart, setCopiedPart] = useState(null);
  const [sendingPart, setSendingPart] = useState(null);
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [jiraTrack, setJiraTrack] = useState(null);
  const [slackTrack, setSlackTrack] = useState(null);
  const { remindTrackConfig } = useCatalog();
  const workerOn = isRemindTrackConfigured();
  const slackRecipient = useMemo(
    () => (editor ? resolveSlackRecipient(editor, slackConfig) : null),
    [editor, slackConfig],
  );
  const slackUserId = slackRecipient?.userId ?? null;
  const autoSlack = canAutoSendSlack(editor, slackConfig);

  const chunks = useMemo(
    () => splitReminderPageChunks(pages, REMIND_PAGES_PER_MESSAGE),
    [pages],
  );

  const partTotal = chunks.length;
  const safePreview = Math.min(previewIndex, Math.max(0, partTotal - 1));
  const previewChunk = chunks[safePreview] || [];
  const globalOffset = safePreview * REMIND_PAGES_PER_MESSAGE;

  const message =
    editor && previewChunk.length
      ? buildBundledReviewMessage({
          editor,
          pages: previewChunk,
          site,
          partIndex: safePreview + 1,
          partTotal,
          globalOffset,
        })
      : '';

  const handle = editor ? guessSlackHandle(editor) : null;
  const email = editor ? guessEmail(editor) : null;
  const mailto =
    editor && previewChunk.length
      ? buildBundledReviewMailto({
          editor,
          pages: previewChunk,
          site,
          partIndex: safePreview + 1,
          partTotal,
          globalOffset,
        })
      : '#';

  if (!editor || !pages?.length) return null;

  async function copyPreview() {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedPart(safePreview);
    } catch {
      setCopiedPart(null);
    }
  }

  async function handleOpenSlackPart(partIdx) {
    if (sendingPart !== null) return;
    const chunk = chunks[partIdx];
    if (!chunk?.length) return;

    setSendingPart(partIdx);
    setError('');
    setJiraTrack(null);
    setSlackTrack(null);
    try {
      const slackMessage = buildBundledReviewMessage({
        editor,
        pages: chunk,
        site,
        partIndex: partIdx + 1,
        partTotal,
        globalOffset: partIdx * REMIND_PAGES_PER_MESSAGE,
      });

      if (workerOn) {
        const result = await dispatchRemind({
          editor,
          editorEmail: guessEmail(editor),
          message: slackMessage,
          pagesCount: chunk.length,
          partIndex: partIdx + 1,
          partTotal,
          remindTrackConfig,
          slackUserId,
          sendSlack: autoSlack,
          createJira: true,
        });

        if (result.slack) setSlackTrack(result.slack);
        if (result.jira) setJiraTrack(result.jira);

        if (!result.skipped && result.error && !slackRemindAccepted(result.slack) && !result.jira?.ok) {
          setError(result.error);
        }

        if (autoSlack && result.slack && !slackRemindAccepted(result.slack)) {
          setError(
            result.slack.error ||
              result.error ||
              'Slack DM did not send — Jira may still have been created.',
          );
        }

        if (slackRemindAccepted(result.slack)) {
          setCopiedPart(partIdx);
          if (partTotal === 1) {
            setTimeout(() => onClose?.(), 1800);
          }
          return;
        }

        if (autoSlack) {
          return;
        }

        if (result.ok && !autoSlack) {
          setCopiedPart(partIdx);
          return;
        }
      }

      await openBundledSlackReview({
        editor,
        pages: chunk,
        site,
        slackConfig,
        partIndex: partIdx + 1,
        partTotal,
        globalOffset: partIdx * REMIND_PAGES_PER_MESSAGE,
      });
      setCopiedPart(partIdx);

      if (workerOn && !autoSlack) {
        const jiraOnly = await dispatchRemind({
          editor,
          editorEmail: guessEmail(editor),
          message: slackMessage,
          pagesCount: chunk.length,
          partIndex: partIdx + 1,
          partTotal,
          remindTrackConfig,
          sendSlack: false,
          createJira: true,
        });
        if (jiraOnly.jira) setJiraTrack(jiraOnly.jira);
      }

      if (partTotal === 1 && !workerOn) {
        setTimeout(() => onClose?.(), 1400);
      }
    } catch (err) {
      setError(err?.message || 'Could not open Slack');
    } finally {
      setSendingPart(null);
    }
  }

  return (
    <div className="review-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="review-modal card"
        role="dialog"
        aria-labelledby="review-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="review-modal-header">
          <h2 id="review-modal-title">Remind {editor}</h2>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="review-modal-sub">
          {pages.length} outdated page{pages.length === 1 ? '' : 's'}
          {partTotal > 1 ? ` · ${partTotal} Slack messages` : ''}
          {handle ? (
            <>
              {' '}
              · <span className="mono">@{handle}</span>
            </>
          ) : null}
          {email ? (
            <>
              {' '}
              · <span className="mono">{email}</span>
            </>
          ) : null}
          {autoSlack && slackRecipient ? (
            <>
              {' '}
              · Slack DM →{' '}
              <span className="mono" title={slackRecipient.userId}>
                {slackRecipient.matchedAs}
              </span>
            </>
          ) : null}
        </p>

        <p className="remind-confirm-mode">
          {partTotal > 1 ? (
            <>
              Select a <strong>Part</strong> tab, then send.
              {autoSlack ? (
                <>
                  {' '}
                  The catalog will <strong>DM them on Slack</strong> automatically
                  {workerOn ? (
                    <>
                      {' '}
                      and create a <strong>Jira task</strong>.
                    </>
                  ) : (
                    '.'
                  )}
                </>
              ) : (
                <>
                  {' '}
                  <strong>Copy &amp; open Slack</strong> for that message ({partTotal} messages, same DM).
                  {workerOn ? ' Creates a ' : null}
                  {workerOn ? <strong>Jira task</strong> : null}
                  {workerOn ? ' when the remind service is reachable.' : null}
                  {!slackUserId && workerOn ? (
                    <>
                      {' '}
                      (No Slack user id in <span className="mono">slack.json</span> — paste manually.)
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              {autoSlack ? (
                <>
                  Sends a <strong>Slack DM</strong> automatically
                  {workerOn ? (
                    <>
                      {' '}
                      and creates a <strong>Jira task</strong>.
                    </>
                  ) : (
                    '.'
                  )}
                </>
              ) : (
                <>
                  Confirm will <strong>copy the message</strong> and open Slack — paste into their DM.
                  {workerOn ? ' Creates a ' : null}
                  {workerOn ? <strong>Jira task</strong> : null}
                  {workerOn ? ' when the remind service is reachable.' : null}
                </>
              )}
            </>
          )}
        </p>

        {slackRemindDelivered(slackTrack) && (
          <p className="review-modal-copied" role="status">
            ✓ Slack DM verified in recipient bot thread →{' '}
            {slackTrack.recipientName ||
              slackRecipient?.matchedAs ||
              (handle ? `@${handle}` : editor)}
            .
          </p>
        )}
        {slackRemindAccepted(slackTrack) && !slackRemindDelivered(slackTrack) && (
          <p className="review-modal-jira-warn" role="status">
            Slack accepted the DM to {slackTrack.recipientName || editor}. Recipient must check{' '}
            <strong>DMs with the catalog Slack app</strong> (not your personal Slack).
            {slackTrack.verifyNote ? ` ${slackTrack.verifyNote}` : null}
          </p>
        )}
        {slackTrack && !slackRemindAccepted(slackTrack) && (
          <p className="review-modal-jira-warn" role="status">
            Slack DM failed: {slackTrack.error}. Use copy &amp; open below if needed.
          </p>
        )}
        {copiedPart !== null && !error && !slackRemindAccepted(slackTrack) && (
          <p className="review-modal-copied" role="status">
            ✓ Message {copiedPart + 1} copied — paste in Slack
            {handle ? ` to @${handle}` : ''}.
          </p>
        )}
        {jiraTrack?.ok && jiraTrack.issueKey && (
          <p className="review-modal-jira" role="status">
            ✓ Jira{' '}
            <a href={jiraTrack.issueUrl} target="_blank" rel="noreferrer">
              {jiraTrack.issueKey}
            </a>{' '}
            created
            {jiraTrack.assigneeSet ? '' : ' (assign manually if needed)'}.
          </p>
        )}
        {jiraTrack && !jiraTrack.ok && jiraTrack.error && (
          <p className="review-modal-jira-warn" role="status">
            Jira: {jiraTrack.error || 'could not create issue'}.
            {slackTrack?.ok ? ' Slack DM was still sent.' : ' Use copy & open if needed.'}
          </p>
        )}
        {error && (
          <p className="remind-confirm-error" role="alert">
            {error}
          </p>
        )}

        {partTotal > 1 && (
          <div className="review-modal-chunk-tabs" role="tablist" aria-label="Message parts">
            {chunks.map((chunk, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === safePreview}
                className={`review-modal-chunk-tab${idx === safePreview ? ' active' : ''}${
                  copiedPart === idx ? ' sent' : ''
                }`}
                onClick={() => {
                  setPreviewIndex(idx);
                  setCopiedPart(null);
                  setJiraTrack(null);
                  setSlackTrack(null);
                }}
              >
                Part {idx + 1}
                <span className="review-modal-chunk-tab-meta">
                  {chunk.length} page{chunk.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="review-modal-preview-label">
          Preview{partTotal > 1 ? ` (part ${safePreview + 1} of ${partTotal})` : ''}
        </p>
        <pre className="review-modal-body">{message}</pre>

        <div className="review-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={sendingPart !== null}
            onClick={() => handleOpenSlackPart(safePreview)}
          >
            {sendingPart === safePreview
              ? 'Sending…'
              : autoSlack
                ? partTotal > 1
                  ? `Send Slack DM (part ${safePreview + 1}/${partTotal})`
                  : 'Send Slack DM'
                : partTotal > 1
                  ? `Copy & open Slack (part ${safePreview + 1}/${partTotal})`
                  : 'Copy & open Slack'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sendingPart !== null}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Hide options' : 'More options'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sendingPart !== null}>
            {partTotal > 1 ? 'Done' : 'Cancel'}
          </button>
        </div>

        {showMore && (
          <div className="review-modal-more">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={copyPreview}
              disabled={sendingPart !== null}
            >
              Copy preview only
            </button>
            <a className="btn btn-secondary btn-sm" href={mailto}>
              Email (this part)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

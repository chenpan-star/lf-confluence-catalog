import { useEffect, useMemo, useState } from 'react';
import { buildBundledReviewMailto, guessEmail } from '../lib/contact';
import {
  buildRemindJiraPartKey,
  canAutoSendSlack,
  dispatchRemind,
  isRemindTrackConfigured,
  readRemindJiraPartLock,
  rememberRemindJiraSuccess,
  slackRemindAccepted,
  slackRemindDelivered,
} from '../lib/remindTrack';
import {
  buildBundledReviewMessage,
  buildSlackUrl,
  guessSlackHandle,
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
  /** part index → { issueKey, issueUrl, duplicate } after successful Jira (this session). */
  const [jiraByPart, setJiraByPart] = useState({});
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

  useEffect(() => {
    const fromSession = {};
    for (let idx = 0; idx < chunks.length; idx += 1) {
      const chunk = chunks[idx] || [];
      const key = buildRemindJiraPartKey({
        editor,
        partIndex: idx + 1,
        partTotal: chunks.length,
        pageIds: chunk.map((p) => p.id),
      });
      const lock = readRemindJiraPartLock(key);
      if (lock?.issueKey) fromSession[idx] = lock;
    }
    if (Object.keys(fromSession).length) {
      setJiraByPart((prev) => ({ ...fromSession, ...prev }));
    }
  }, [editor, chunks, partTotal]);

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
          jiraPending: workerOn,
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

  function partJiraKey(partIdx) {
    const chunk = chunks[partIdx] || [];
    return buildRemindJiraPartKey({
      editor,
      partIndex: partIdx + 1,
      partTotal,
      pageIds: chunk.map((p) => p.id),
    });
  }

  function jiraLockForPart(partIdx) {
    return jiraByPart[partIdx] || readRemindJiraPartLock(partJiraKey(partIdx));
  }

  function recordJiraForPart(partIdx, jira) {
    const key = partJiraKey(partIdx);
    const entry = rememberRemindJiraSuccess(key, jira);
    if (entry) {
      setJiraByPart((prev) => ({ ...prev, [partIdx]: entry }));
      setJiraTrack({ ok: true, ...entry });
    }
  }

  async function copyPreview() {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedPart(safePreview);
    } catch {
      setCopiedPart(null);
    }
  }

  async function runRemindPart(partIdx, action) {
    if (sendingPart !== null) return;
    const chunk = chunks[partIdx];
    if (!chunk?.length) return;

    if (action === 'jira' && jiraLockForPart(partIdx)) {
      setError(`Jira ${jiraLockForPart(partIdx).issueKey} is already linked to this part.`);
      return;
    }

    if (action === 'slack' && !jiraLockForPart(partIdx)) {
      setError('Create the Jira task for this part first, then send Slack DM.');
      return;
    }

    const jiraLock = action === 'slack' ? jiraLockForPart(partIdx) : null;
    const actionKey = `${action}-${partIdx}`;
    setSendingPart(actionKey);
    setError('');

    const slackMessage = buildBundledReviewMessage({
      editor,
      pages: chunk,
      site,
      partIndex: partIdx + 1,
      partTotal,
      globalOffset: partIdx * REMIND_PAGES_PER_MESSAGE,
      jira: jiraLock || null,
      jiraPending: workerOn && !jiraLock,
    });

    try {
      if (action === 'copy') {
        const lock = jiraLockForPart(partIdx);
        const message = buildBundledReviewMessage({
          editor,
          pages: chunk,
          site,
          partIndex: partIdx + 1,
          partTotal,
          globalOffset: partIdx * REMIND_PAGES_PER_MESSAGE,
          jira: lock || null,
          jiraPending: workerOn && !lock,
        });
        const url = buildSlackUrl(editor, slackConfig);
        try {
          await navigator.clipboard.writeText(message);
        } catch {
          /* clipboard may be blocked */
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        setCopiedPart(partIdx);
        if (partTotal === 1) {
          setTimeout(() => onClose?.(), 1400);
        }
        return;
      }

      if (!workerOn) {
        setError('Remind service is not configured.');
        return;
      }

      const result = await dispatchRemind({
        editor,
        editorEmail: guessEmail(editor),
        message: slackMessage,
        pagesCount: chunk.length,
        partIndex: partIdx + 1,
        partTotal,
        remindTrackConfig,
        slackUserId,
        sendSlack: action === 'slack' && autoSlack,
        createJira: action === 'jira',
        jiraIssueKey: jiraLock?.issueKey,
        jiraIssueUrl: jiraLock?.issueUrl,
      });

      if (action === 'slack') {
        setSlackTrack(result.slack ?? null);
        if (slackRemindAccepted(result.slack)) {
          setCopiedPart(partIdx);
        } else {
          setError(result.slack?.error || result.error || 'Slack DM did not send.');
        }
      }

      if (action === 'jira') {
        if (result.jira?.ok) {
          recordJiraForPart(partIdx, result.jira);
        } else {
          setJiraTrack(result.jira ?? null);
          setError(result.jira?.error || result.error || 'Jira task was not created.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Remind action failed');
    } finally {
      setSendingPart(null);
    }
  }

  const isSending = sendingPart !== null;
  const sendingSlack = sendingPart === `slack-${safePreview}`;
  const sendingJira = sendingPart === `jira-${safePreview}`;
  const sendingCopy = sendingPart === `copy-${safePreview}`;
  const jiraLocked = Boolean(jiraLockForPart(safePreview));
  const jiraLockedInfo = jiraLockForPart(safePreview);

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
          {autoSlack && email ? (
            <>
              {' '}
              · Worker will look up <span className="mono">{email}</span> in Slack
            </>
          ) : null}
        </p>

        <p className="remind-confirm-mode">
          {partTotal > 1 ? (
            <>
              For each part: <strong>Create Jira task</strong> first, then <strong>Send Slack DM</strong>{' '}
              (or copy &amp; open Slack manually).
            </>
          ) : (
            <>
              {workerOn && autoSlack ? (
                <>
                  <strong>Create Jira task</strong> first, then <strong>Send Slack DM</strong> with the
                  ticket link. Use <strong>Copy &amp; open Slack</strong> to paste manually anytime.
                </>
              ) : workerOn ? (
                <>
                  <strong>Create Jira task</strong> for PROT tracking, or <strong>Copy &amp; open Slack</strong>{' '}
                  to paste manually.
                </>
              ) : (
                <>Use <strong>Copy &amp; open Slack</strong> to paste the message manually.</>
              )}
            </>
          )}
        </p>

        {slackRemindDelivered(slackTrack) && (
          <p className="review-modal-copied" role="status">
            ✓ Slack DM verified in recipient bot thread → {slackTrack.recipientName || editor}.
          </p>
        )}
        {slackRemindAccepted(slackTrack) && !slackRemindDelivered(slackTrack) && (
          <p className="review-modal-copied" role="status">
            ✓ Slack accepted DM to {slackTrack.recipientName || editor}
            {slackTrack.jiraIssueKey || jiraTrack?.issueKey ? (
              <>
                {' '}
                · Jira{' '}
                <a href={jiraTrack?.issueUrl} target="_blank" rel="noreferrer">
                  {slackTrack.jiraIssueKey || jiraTrack?.issueKey}
                </a>{' '}
                linked in message
              </>
            ) : null}
            {slackTrack.matchedEmail || slackTrack.resolvedVia === 'email' ? (
              <>
                {' '}
                (<span className="mono">{slackTrack.matchedEmail || email}</span>)
              </>
            ) : null}
            . <strong>{editor}</strong> must open Slack → DMs → <strong>catalog bot</strong> on{' '}
            <em>their</em> account (you will not see it in your Slack unless you are the owner).
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
            {jiraTrack.duplicate ? (
              <>
                ✓ Already open —{' '}
                <a href={jiraTrack.issueUrl} target="_blank" rel="noreferrer">
                  {jiraTrack.issueKey}
                </a>{' '}
                (same remind; not created again).
              </>
            ) : (
              <>
                ✓ Jira{' '}
                <a href={jiraTrack.issueUrl} target="_blank" rel="noreferrer">
                  {jiraTrack.issueKey}
                </a>{' '}
                created
                {jiraTrack.assigneeSet ? '' : ' (assign manually if needed)'}.
              </>
            )}
            {!jiraTrack.duplicate && jiraTrack.notifyEmail?.mentionOk
              ? ' @mention comment added (check Jira bell). Inbox email only if the assignee’s Jira profile has email enabled for mentions; otherwise use Slack DM or ask a Jira admin for a PROT Automation email rule (see DEPLOY.md).'
              : null}
            {!jiraTrack.duplicate && jiraTrack.notifyEmail?.ok && !jiraTrack.notifyEmail?.mentionOk
              ? ` Owner notified (assign email: ${jiraTrack.notifyEmail.assignNotifyOk ? 'yes' : 'no'}, notify API: ${jiraTrack.notifyEmail.notifyOk ? 'yes' : 'no'}).`
              : null}
            {!jiraTrack.duplicate &&
            jiraTrack.notifyEmail &&
            !jiraTrack.notifyEmail.ok &&
            !jiraTrack.notifyEmail.skipped &&
            jiraTrack.notifyEmail.error
              ? ` Owner notification failed: ${jiraTrack.notifyEmail.error}`
              : null}
          </p>
        )}
        {jiraTrack && !jiraTrack.ok && jiraTrack.error && (
          <p className="review-modal-jira-warn" role="status">
            Jira: {jiraTrack.error || 'could not create issue'}.
            {slackRemindAccepted(slackTrack) ? ' Slack DM was still sent.' : ' Use copy & open if needed.'}
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
                }${jiraLockForPart(idx) ? ' jira-done' : ''}`}
                onClick={() => {
                  setPreviewIndex(idx);
                  setCopiedPart(null);
                  const locked = jiraLockForPart(idx);
                  setJiraTrack(locked ? { ok: true, ...locked } : null);
                  setSlackTrack(null);
                }}
              >
                Part {idx + 1}
                <span className="review-modal-chunk-tab-meta">
                  {chunk.length} page{chunk.length === 1 ? '' : 's'}
                  {jiraLockForPart(idx) ? ` · ${jiraLockForPart(idx).issueKey}` : ''}
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
          {workerOn ? (
            <button
              type="button"
              className={jiraLocked ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={isSending || jiraLocked}
              title={
                jiraLocked
                  ? `Jira ${jiraLockedInfo.issueKey} already created for this part`
                  : undefined
              }
              onClick={() => runRemindPart(safePreview, 'jira')}
            >
              {jiraLocked
                ? `Jira ${jiraLockedInfo.issueKey} ✓`
                : sendingJira
                  ? 'Creating…'
                  : partTotal > 1
                    ? `Create Jira (part ${safePreview + 1}/${partTotal})`
                    : 'Create Jira task'}
            </button>
          ) : null}
          {workerOn && autoSlack ? (
            <button
              type="button"
              className={jiraLocked ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={isSending || !jiraLocked}
              title={
                !jiraLocked
                  ? 'Create the Jira task for this part first'
                  : undefined
              }
              onClick={() => runRemindPart(safePreview, 'slack')}
            >
              {sendingSlack
                ? 'Sending…'
                : partTotal > 1
                  ? `Send Slack DM (part ${safePreview + 1}/${partTotal})`
                  : 'Send Slack DM'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSending}
              onClick={() => runRemindPart(safePreview, 'copy')}
            >
              {sendingCopy
                ? 'Opening…'
                : partTotal > 1
                  ? `Copy & open Slack (part ${safePreview + 1}/${partTotal})`
                  : 'Copy & open Slack'}
            </button>
          )}
          {workerOn && autoSlack ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isSending}
              onClick={() => runRemindPart(safePreview, 'copy')}
            >
              {sendingCopy ? 'Opening…' : 'Copy & open Slack'}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSending}>
            {partTotal > 1 ? 'Done' : 'Cancel'}
          </button>
        </div>

        {showMore && (
          <div className="review-modal-more">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={copyPreview}
              disabled={isSending}
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

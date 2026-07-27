import { useMemo, useState } from 'react';
import { buildBundledReviewMailto, guessEmail } from '../lib/contact';
import {
  buildBundledReviewMessage,
  guessSlackHandle,
  openBundledSlackReview,
  REMIND_PAGES_PER_MESSAGE,
  splitReminderPageChunks,
} from '../lib/slack';
import './ReviewMessageModal.css';
import './HygieneHelp.css';

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
    try {
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
      if (partTotal === 1) {
        setTimeout(() => onClose?.(), 1400);
      }
    } catch (err) {
      setError(err?.message || 'Could not open Slack');
    } finally {
      setSendingPart(null);
    }
  }

  const multiPartHint =
    partTotal > 1
      ? ` Slack limits how long one message can be — send ${partTotal} messages (same DM), one per button below.`
      : '';

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
        </p>

        <p className="remind-confirm-mode">
          Each button <strong>copies that message</strong> and opens Slack — paste into their DM.
          {multiPartHint}
        </p>

        {copiedPart !== null && !error && (
          <p className="review-modal-copied" role="status">
            ✓ Message {copiedPart + 1} copied — paste in Slack
            {handle ? ` to @${handle}` : ''}.
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
                onClick={() => setPreviewIndex(idx)}
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
          {partTotal === 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={sendingPart !== null}
              onClick={() => handleOpenSlackPart(0)}
            >
              {sendingPart === 0 ? 'Opening…' : 'Copy & open Slack'}
            </button>
          ) : (
            chunks.map((chunk, idx) => (
              <button
                key={idx}
                type="button"
                className={`btn btn-primary${idx > 0 ? ' btn-sm' : ''}`}
                disabled={sendingPart !== null}
                onClick={() => handleOpenSlackPart(idx)}
                title={`${chunk.length} pages in this message`}
              >
                {sendingPart === idx
                  ? 'Opening…'
                  : `Copy & open Slack (part ${idx + 1}/${partTotal})`}
              </button>
            ))
          )}
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

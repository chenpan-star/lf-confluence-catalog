import { buildBundledReviewMailto } from '../lib/contact';
import { buildBundledReviewMessage, guessSlackHandle } from '../lib/slack';
import './ReviewMessageModal.css';

export default function ReviewMessageModal({
  editor,
  pages,
  site,
  onClose,
  onSendSlack,
}) {
  if (!editor || !pages?.length) return null;

  const message = buildBundledReviewMessage({ editor, pages, site });
  const handle = guessSlackHandle(editor);
  const mailto = buildBundledReviewMailto({ editor, pages, site });

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="review-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="review-modal card"
        role="dialog"
        aria-labelledby="review-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="review-modal-header">
          <h2 id="review-modal-title">Message {editor}</h2>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="review-modal-sub">
          {pages.length} stale page{pages.length === 1 ? '' : 's'}
          {handle ? (
            <>
              {' '}
              · Slack <span className="mono">@{handle}</span>
            </>
          ) : null}
        </p>

        <pre className="review-modal-body">{message}</pre>

        <div className="review-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={copyMessage}>
            Copy message
          </button>
          <button type="button" className="btn btn-primary" onClick={onSendSlack}>
            Open Slack
          </button>
          <a className="btn btn-secondary" href={mailto}>
            Send email
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

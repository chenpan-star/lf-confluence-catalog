import { useEffect, useState } from 'react';
import { buildBundledReviewMailto } from '../lib/contact';
import { buildBundledReviewMessage, guessSlackHandle } from '../lib/slack';
import './ReviewMessageModal.css';
import './HygieneHelp.css';

export default function ReviewMessageModal({
  editor,
  pages,
  site,
  onClose,
  onSendSlack,
}) {
  const [copied, setCopied] = useState(false);

  const message =
    editor && pages?.length
      ? buildBundledReviewMessage({ editor, pages, site })
      : '';
  const handle = editor ? guessSlackHandle(editor) : null;
  const mailto =
    editor && pages?.length
      ? buildBundledReviewMailto({ editor, pages, site })
      : '#';

  useEffect(() => {
    if (!message) return undefined;
    let active = true;
    (async () => {
      try {
        await navigator.clipboard.writeText(message);
        if (active) setCopied(true);
      } catch {
        /* clipboard may be blocked */
      }
    })();
    return () => {
      active = false;
    };
  }, [message]);

  if (!editor || !pages?.length) return null;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
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
          <h2 id="review-modal-title">Reminder for {editor}</h2>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="review-modal-sub">
          {pages.length} outdated page{pages.length === 1 ? '' : 's'} included
          {handle ? (
            <>
              {' '}
              · paste into Slack DM to <span className="mono">@{handle}</span>
            </>
          ) : null}
        </p>

        {copied && (
          <p className="review-modal-copied" role="status">
            ✓ Message copied — ready to paste in Slack
          </p>
        )}

        <div className="review-modal-steps">
          <strong>Next:</strong> Click Open Slack → find {handle ? `@${handle}` : editor} → paste
          and send.
        </div>

        <pre className="review-modal-body">{message}</pre>

        <div className="review-modal-actions">
          <button type="button" className="btn btn-primary" onClick={onSendSlack}>
            Open Slack
          </button>
          <button type="button" className="btn btn-secondary" onClick={copyMessage}>
            Copy again
          </button>
          <a className="btn btn-secondary" href={mailto}>
            Use email instead
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { buildBundledReviewMailto, guessEmail } from '../lib/contact';
import {
  buildBundledReviewMessage,
  guessSlackHandle,
  openBundledSlackReview,
} from '../lib/slack';
import './ReviewMessageModal.css';
import './HygieneHelp.css';

export default function ReviewMessageModal({
  editor,
  pages,
  site,
  slackConfig,
  onClose,
  onSendSlack,
}) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMore, setShowMore] = useState(false);

  const message =
    editor && pages?.length
      ? buildBundledReviewMessage({ editor, pages, site })
      : '';
  const handle = editor ? guessSlackHandle(editor) : null;
  const email = editor ? guessEmail(editor) : null;
  const mailto =
    editor && pages?.length
      ? buildBundledReviewMailto({ editor, pages, site })
      : '#';

  if (!editor || !pages?.length) return null;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleOpenSlack() {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await copyMessage();
      if (onSendSlack) await onSendSlack();
      else await openBundledSlackReview({ editor, pages, site, slackConfig });
      setSuccess(`Copied — paste in Slack to ${handle ? `@${handle}` : editor}.`);
      setTimeout(() => onClose?.(), 1400);
    } catch (err) {
      setError(err?.message || 'Could not open Slack');
      setSending(false);
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
          <h2 id="review-modal-title">Send reminder to {editor}?</h2>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="review-modal-sub">
          {pages.length} outdated page{pages.length === 1 ? '' : 's'}
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
          Confirm will <strong>copy the message</strong> and open Slack so you can paste it into
          their DM.
        </p>

        {copied && !success && !error && (
          <p className="review-modal-copied" role="status">
            ✓ Message copied
          </p>
        )}
        {success && (
          <p className="review-modal-copied" role="status">
            ✓ {success}
          </p>
        )}
        {error && (
          <p className="remind-confirm-error" role="alert">
            {error}
          </p>
        )}

        <p className="review-modal-preview-label">Message preview</p>
        <pre className="review-modal-body">{message}</pre>

        <div className="review-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || Boolean(success)}
            onClick={handleOpenSlack}
          >
            {sending ? 'Opening…' : 'Copy & open Slack'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sending}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Hide options' : 'More options'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </div>

        {showMore && (
          <div className="review-modal-more">
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyMessage} disabled={sending}>
              Copy again
            </button>
            <a className="btn btn-secondary btn-sm" href={mailto}>
              Use email instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

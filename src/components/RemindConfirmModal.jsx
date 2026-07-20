import { useState } from 'react';
import './ReviewMessageModal.css';

/** Confirm before copying a reminder and opening Slack. */
export default function RemindConfirmModal({
  title = 'Send Slack reminder?',
  recipientName,
  recipientHandle,
  recipientEmail,
  messagePreview,
  onOpenSlack,
  onClose,
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleOpenSlack() {
    if (!onOpenSlack || sending) return;
    setSending(true);
    setError('');
    try {
      await onOpenSlack();
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not open Slack');
      setSending(false);
    }
  }

  return (
    <div className="review-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="review-modal card remind-confirm-modal"
        role="dialog"
        aria-labelledby="remind-confirm-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="review-modal-header">
          <h2 id="remind-confirm-title">{title}</h2>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="review-modal-sub">
          Message will go to <strong>{recipientName || 'unknown'}</strong>
          {recipientHandle ? (
            <>
              {' '}
              (<span className="mono">@{recipientHandle}</span>)
            </>
          ) : null}
          {recipientEmail ? (
            <>
              {' '}
              · <span className="mono">{recipientEmail}</span>
            </>
          ) : null}
        </p>

        <p className="remind-confirm-mode">
          Confirm will <strong>copy the message</strong> and open Slack so you can paste it into
          their DM.
        </p>

        {error && (
          <p className="remind-confirm-error" role="alert">
            {error}
          </p>
        )}

        <pre className="review-modal-body">{messagePreview}</pre>

        <div className="review-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending}
            onClick={handleOpenSlack}
          >
            {sending ? 'Opening…' : 'Copy & open Slack'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={sending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

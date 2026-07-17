import { useState } from 'react';
import './ReviewMessageModal.css';

/**
 * Confirm before sending a Slack DM via the bot (or fallback to clipboard + open Slack).
 */
export default function RemindConfirmModal({
  title = 'Send Slack reminder?',
  recipientName,
  recipientHandle,
  recipientEmail,
  messagePreview,
  botConfigured,
  onConfirmSend,
  onFallbackOpenSlack,
  onClose,
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const label = recipientHandle
    ? `@${recipientHandle}`
    : recipientName || 'this person';

  async function handleSendDm() {
    if (!onConfirmSend || sending) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const result = await onConfirmSend();
      if (result?.ok) {
        if (result.openedSlackManually) {
          onClose?.();
          return;
        }
        setSuccess(
          result.email
            ? `DM sent to ${label} (${result.email}).`
            : `DM sent to ${label}.`,
        );
        setTimeout(() => onClose?.(), 1600);
      } else {
        setError(result?.error || 'Failed to send DM');
      }
    } catch (err) {
      setError(err?.message || 'Failed to send DM');
    } finally {
      setSending(false);
    }
  }

  async function handleFallback() {
    if (!onFallbackOpenSlack || sending) return;
    setSending(true);
    setError('');
    try {
      await onFallbackOpenSlack();
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

        {botConfigured ? (
          <p className="remind-confirm-mode">
            After you confirm, the Slack bot will <strong>DM them directly</strong>.
          </p>
        ) : (
          <p className="remind-confirm-mode remind-confirm-mode-warn">
            Bot API is not configured — confirm will <strong>copy the message</strong> and open
            Slack for you to paste.
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

        <pre className="review-modal-body">{messagePreview}</pre>

        <div className="review-modal-actions">
          {botConfigured ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending || Boolean(success)}
                onClick={handleSendDm}
              >
                {sending ? 'Sending…' : 'Send DM'}
              </button>
              {onFallbackOpenSlack && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={sending || Boolean(success)}
                  onClick={handleFallback}
                >
                  Copy &amp; open Slack instead
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending}
              onClick={handleFallback}
            >
              {sending ? 'Opening…' : 'Copy & open Slack'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" disabled={sending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

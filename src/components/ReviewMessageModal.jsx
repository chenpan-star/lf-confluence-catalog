import { useEffect, useState } from 'react';
import { buildBundledReviewMailto, guessEmail } from '../lib/contact';
import {
  buildBundledReviewMessage,
  guessSlackHandle,
  isBotRemindConfigured,
  openBundledSlackReview,
  sendSlackReminderViaBot,
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
  const botConfigured = isBotRemindConfigured(slackConfig);

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

  async function handleSendDm() {
    if (sending) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const first = pages[0];
      const result = await sendSlackReminderViaBot({
        contactName: editor,
        email: email || '',
        message,
        pageTitle: `${pages.length} outdated page(s)`,
        spaceName: first?.spaceName || '',
        spaceKey: first?.spaceKey || '',
        confluenceUrl: first?.url || '',
        catalogPageUrl: '',
        slackConfig,
      });

      if (result.ok) {
        setSuccess(
          result.email
            ? `DM sent to ${handle ? `@${handle}` : editor} (${result.email}).`
            : `DM sent to ${handle ? `@${handle}` : editor}.`,
        );
        setTimeout(() => onClose?.(), 1600);
        return;
      }

      if (result.fallback) {
        await (onSendSlack?.() ??
          openBundledSlackReview({ editor, pages, site, slackConfig }));
        onClose?.();
        return;
      }

      setError(result.error || 'Failed to send DM');
    } catch (err) {
      setError(err?.message || 'Failed to send DM');
    } finally {
      setSending(false);
    }
  }

  async function handleOpenSlack() {
    if (sending) return;
    setSending(true);
    try {
      if (onSendSlack) await onSendSlack();
      else await openBundledSlackReview({ editor, pages, site, slackConfig });
      onClose?.();
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
              · Slack <span className="mono">@{handle}</span>
            </>
          ) : null}
          {email ? (
            <>
              {' '}
              · <span className="mono">{email}</span>
            </>
          ) : null}
        </p>

        {botConfigured ? (
          <p className="remind-confirm-mode">
            Confirm to have the Slack bot <strong>DM them directly</strong>, or open Slack to paste
            manually.
          </p>
        ) : (
          <p className="remind-confirm-mode remind-confirm-mode-warn">
            Bot API is not configured — use <strong>Open Slack</strong> and paste the message.
          </p>
        )}

        {copied && !success && (
          <p className="review-modal-copied" role="status">
            ✓ Message copied — ready to paste in Slack
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

        <pre className="review-modal-body">{message}</pre>

        <div className="review-modal-actions">
          {botConfigured && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending || Boolean(success)}
              onClick={handleSendDm}
            >
              {sending ? 'Sending…' : 'Send DM'}
            </button>
          )}
          <button
            type="button"
            className={botConfigured ? 'btn btn-secondary' : 'btn btn-primary'}
            disabled={sending || Boolean(success)}
            onClick={handleOpenSlack}
          >
            {botConfigured ? 'Copy & open Slack' : 'Open Slack'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={copyMessage} disabled={sending}>
            Copy again
          </button>
          <a className="btn btn-secondary" href={mailto}>
            Use email instead
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

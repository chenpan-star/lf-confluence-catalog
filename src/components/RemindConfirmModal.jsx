import { useState } from 'react';
import './ReviewMessageModal.css';

/** Confirm before sending a reminder (Slack DM, Jira, or manual copy). */
export default function RemindConfirmModal({
  title = 'Send reminder?',
  recipientName,
  recipientHandle,
  recipientEmail,
  messagePreview,
  workerOn = false,
  autoSlack = false,
  onSendSlackDm,
  onCreateJira,
  onCopyOpenSlack,
  onClose,
  jiraCreated = null,
}) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function run(action, fn) {
    if (!fn || busy) return;
    setBusy(action);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Action failed');
    } finally {
      setBusy(null);
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
          Remind <strong>{recipientName || 'unknown'}</strong>
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
          {workerOn && autoSlack ? (
            <>
              <strong>Create Jira</strong> first, then <strong>Send Slack DM</strong> with the ticket link.
              Use <strong>Copy &amp; open Slack</strong> to paste manually anytime.
            </>
          ) : workerOn ? (
            <>
              Use <strong>Create Jira</strong> for PROT tracking, or <strong>Copy &amp; open Slack</strong>{' '}
              to paste manually.
            </>
          ) : (
            <>Confirm will copy the message and open Slack so you can paste it into their DM.</>
          )}
        </p>

        {error && (
          <p className="remind-confirm-error" role="alert">
            {error}
          </p>
        )}

        <pre className="review-modal-body">{messagePreview}</pre>

        <div className="review-modal-actions">
          {workerOn && onCreateJira ? (
            <button
              type="button"
              className={jiraCreated?.issueKey ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={Boolean(busy) || Boolean(jiraCreated?.issueKey)}
              title={
                jiraCreated?.issueKey
                  ? `Jira ${jiraCreated.issueKey} already created`
                  : undefined
              }
              onClick={() => run('jira', onCreateJira)}
            >
              {jiraCreated?.issueKey
                ? `Jira ${jiraCreated.issueKey} ✓`
                : busy === 'jira'
                  ? 'Creating…'
                  : 'Create Jira task'}
            </button>
          ) : null}
          {workerOn && autoSlack && onSendSlackDm ? (
            <button
              type="button"
              className={jiraCreated?.issueKey ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={Boolean(busy) || !jiraCreated?.issueKey}
              title={
                !jiraCreated?.issueKey ? 'Create the Jira task first' : undefined
              }
              onClick={() => run('slack', onSendSlackDm)}
            >
              {busy === 'slack' ? 'Sending…' : 'Send Slack DM'}
            </button>
          ) : onCopyOpenSlack ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => run('copy', onCopyOpenSlack)}
            >
              {busy === 'copy' ? 'Opening…' : 'Copy & open Slack'}
            </button>
          ) : null}
          {workerOn && autoSlack && onCopyOpenSlack ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={Boolean(busy)}
              onClick={() => run('copy', onCopyOpenSlack)}
            >
              {busy === 'copy' ? 'Opening…' : 'Copy & open Slack'}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

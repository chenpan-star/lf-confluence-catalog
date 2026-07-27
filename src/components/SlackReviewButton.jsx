import { useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { guessEmail, primaryContact } from '../lib/contact';
import {
  buildReviewMessage,
  guessSlackHandle,
  openSlackReview,
  resolveSlackRecipient,
} from '../lib/slack';
import {
  canAutoSendSlack,
  dispatchRemind,
  isRemindTrackConfigured,
  slackRemindAccepted,
  slackRemindDelivered,
} from '../lib/remindTrack';
import RemindConfirmModal from './RemindConfirmModal';

export default function SlackReviewButton({
  page,
  spaceName,
  spaceKey,
  catalogPageUrl = '',
  className = 'btn btn-sm btn-primary',
  children = 'Send reminder',
}) {
  const { catalog, slackConfig, remindTrackConfig } = useCatalog();
  const [hint, setHint] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const email = guessEmail(contact);
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const workerOn = isRemindTrackConfigured();
  const autoSlack = canAutoSendSlack(contact, slackConfig);
  const slackRecipient = resolveSlackRecipient(contact, slackConfig);
  const slackUserId = slackRecipient?.userId ?? null;

  const message = buildReviewMessage({
    page,
    spaceName,
    spaceKey,
    site,
    catalogPageUrl,
  });

  async function dispatch(action) {
    if (!workerOn && action !== 'copy') {
      throw new Error('Remind service is not configured.');
    }

    if (action === 'copy') {
      await openSlackReview({
        page,
        spaceName,
        spaceKey,
        site,
        catalogPageUrl,
        slackConfig,
      });
      const label = handle ? `@${handle}` : contact || 'editor';
      setHint(`Message copied — paste in Slack to ${label}`);
      setTimeout(() => setHint(''), 5000);
      return;
    }

    const result = await dispatchRemind({
      editor: contact || 'Unknown',
      editorEmail: email,
      message,
      pagesCount: 1,
      partIndex: 1,
      partTotal: 1,
      remindTrackConfig,
      slackUserId,
      sendSlack: action === 'slack' && autoSlack,
      createJira: action === 'jira',
    });

    if (action === 'slack') {
      if (slackRemindDelivered(result.slack)) {
        const to =
          result.slack.recipientName || slackRecipient?.matchedAs || (handle ? `@${handle}` : contact);
        setHint(`Slack DM verified to ${to}`);
        setTimeout(() => setHint(''), 6000);
        return;
      }
      if (slackRemindAccepted(result.slack)) {
        const to = result.slack.recipientName || contact;
        setHint(`Slack accepted DM to ${to} — owner checks bot DMs`);
        setTimeout(() => setHint(''), 8000);
        return;
      }
      throw new Error(result.slack?.error || result.error || 'Slack DM did not send');
    }

    if (action === 'jira') {
      if (result.jira?.ok) {
        const notify = result.jira.notifyEmail;
        let extra = '';
        if (notify?.ok) {
          extra = notify.mentionOk ? ' · @mention sent' : notify.notifyOk ? ' · email queued' : ' · notified';
        } else if (notify?.error) {
          extra = ` · notify failed: ${notify.error}`;
        }
        setHint(`Jira ${result.jira.issueKey} created${extra}`);
        setTimeout(() => setHint(''), 6000);
        return;
      }
      throw new Error(result.jira?.error || result.error || 'Jira task was not created');
    }
  }

  return (
    <span className="slack-review-wrap">
      <button type="button" className={className} onClick={() => setConfirmOpen(true)}>
        {children}
      </button>
      {hint && <span className="slack-hint">{hint}</span>}
      {confirmOpen && (
        <RemindConfirmModal
          title="Send reminder?"
          recipientName={contact || 'Unknown'}
          recipientHandle={slackRecipient?.matchedAs || handle}
          recipientEmail={email}
          messagePreview={message}
          workerOn={workerOn}
          autoSlack={autoSlack}
          onSendSlackDm={autoSlack && workerOn ? () => dispatch('slack') : undefined}
          onCreateJira={workerOn ? () => dispatch('jira') : undefined}
          onCopyOpenSlack={() => dispatch('copy')}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </span>
  );
}

import { useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { guessEmail, primaryContact } from '../lib/contact';
import {
  buildReviewMessage,
  guessSlackHandle,
  openSlackReview,
  resolveSlackUserId,
} from '../lib/slack';
import { canAutoSendSlack, dispatchRemind, isRemindTrackConfigured } from '../lib/remindTrack';
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
  const autoSlack = canAutoSendSlack(contact, slackConfig);
  const slackUserId = resolveSlackUserId(contact, slackConfig);

  const message = buildReviewMessage({
    page,
    spaceName,
    spaceKey,
    site,
    catalogPageUrl,
  });

  async function openSlack() {
    if (isRemindTrackConfigured()) {
      const result = await dispatchRemind({
        editor: contact || 'Unknown',
        editorEmail: email,
        message,
        pagesCount: 1,
        partIndex: 1,
        partTotal: 1,
        remindTrackConfig,
        slackUserId,
        sendSlack: autoSlack,
        createJira: true,
      });

      if (result.slack?.ok) {
        const jira = result.jira?.ok ? ` · Jira ${result.jira.issueKey}` : '';
        setHint(`Slack DM sent${jira}`);
        setTimeout(() => setHint(''), 6000);
        return;
      }

      if (autoSlack && result.slack && !result.slack.ok) {
        setHint(`Slack DM failed (${result.slack.error}) — opening manual copy…`);
      }
    }

    await openSlackReview({
      page,
      spaceName,
      spaceKey,
      site,
      catalogPageUrl,
      slackConfig,
    });

    if (isRemindTrackConfigured() && !autoSlack) {
      const jiraOnly = await dispatchRemind({
        editor: contact || 'Unknown',
        editorEmail: email,
        message,
        pagesCount: 1,
        partIndex: 1,
        partTotal: 1,
        remindTrackConfig,
        sendSlack: false,
        createJira: true,
      });
      if (jiraOnly.jira?.ok) {
        setHint(`Copied — Jira ${jiraOnly.jira.issueKey}. Paste in Slack.`);
        setTimeout(() => setHint(''), 6000);
        return;
      }
    }

    const label = handle ? `@${handle}` : contact || 'editor';
    setHint(`Message copied — paste in Slack to ${label}`);
    setTimeout(() => setHint(''), 5000);
  }

  return (
    <span className="slack-review-wrap">
      <button type="button" className={className} onClick={() => setConfirmOpen(true)}>
        {children}
      </button>
      {hint && <span className="slack-hint">{hint}</span>}
      {confirmOpen && (
        <RemindConfirmModal
          title={autoSlack ? 'Send Slack DM?' : 'Send Slack reminder?'}
          recipientName={contact || 'Unknown'}
          recipientHandle={handle}
          recipientEmail={email}
          messagePreview={message}
          onOpenSlack={openSlack}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </span>
  );
}

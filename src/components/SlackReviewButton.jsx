import { useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { guessEmail, primaryContact } from '../lib/contact';
import { formatTitle } from '../lib/text';
import {
  buildReviewMessage,
  guessSlackHandle,
  isBotRemindConfigured,
  openSlackReview,
  sendSlackReminderViaBot,
} from '../lib/slack';
import RemindConfirmModal from './RemindConfirmModal';

export default function SlackReviewButton({
  page,
  spaceName,
  spaceKey,
  catalogPageUrl = '',
  className = 'btn btn-sm btn-primary',
  children = 'Message on Slack',
}) {
  const { catalog, slackConfig } = useCatalog();
  const [hint, setHint] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const email = guessEmail(contact);
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const botConfigured = isBotRemindConfigured(slackConfig);

  const message = buildReviewMessage({
    page,
    spaceName,
    spaceKey,
    site,
    catalogPageUrl,
  });

  const confluenceUrl =
    page?.url || `https://${site}/wiki/spaces/${spaceKey}`;

  async function fallbackOpenSlack() {
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
  }

  async function confirmSendDm() {
    const result = await sendSlackReminderViaBot({
      contactName: contact,
      email: email || '',
      message,
      pageTitle: formatTitle(page?.title),
      spaceName,
      spaceKey,
      confluenceUrl,
      catalogPageUrl,
      slackConfig,
    });

    if (result.ok) {
      setHint(`DM sent to ${handle ? `@${handle}` : contact}`);
      setTimeout(() => setHint(''), 5000);
      return result;
    }

    if (result.fallback) {
      await fallbackOpenSlack();
      return { ok: true, openedSlackManually: true };
    }

    return result;
  }

  return (
    <span className="slack-review-wrap">
      <button type="button" className={className} onClick={() => setConfirmOpen(true)}>
        {children}
      </button>
      {hint && <span className="slack-hint">{hint}</span>}
      {confirmOpen && (
        <RemindConfirmModal
          title="Send Slack reminder?"
          recipientName={contact || 'Unknown'}
          recipientHandle={handle}
          recipientEmail={email}
          messagePreview={message}
          botConfigured={botConfigured}
          onConfirmSend={confirmSendDm}
          onFallbackOpenSlack={fallbackOpenSlack}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </span>
  );
}

import { useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { openSlackReview, guessSlackHandle } from '../lib/slack';
import { primaryContact } from '../lib/contact';

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
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';

  async function handleClick() {
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

  return (
    <span className="slack-review-wrap">
      <button type="button" className={className} onClick={handleClick}>
        {children}
      </button>
      {hint && <span className="slack-hint">{hint}</span>}
    </span>
  );
}

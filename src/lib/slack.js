import { formatTitle } from './text.js';
import { formatDate } from './labels.js';
import { guessEmail, primaryContact } from './contact.js';

export const DEFAULT_SLACK_CONFIG = {
  workspaceUrl: 'https://lotusflare.slack.com',
  teamId: '',
  fallbackChannelId: '',
  users: {},
};

export function guessSlackHandle(name) {
  const email = guessEmail(name);
  if (email) return email.split('@')[0];
  const raw = (name || '').replace(/\s*\(unlicensed\)\s*/gi, '').trim();
  if (/^[a-z0-9._-]+$/i.test(raw) && raw.includes('.')) return raw.toLowerCase();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (first && last) return `${first}.${last}`;
  }
  return null;
}

export function buildReviewMessage({
  page,
  spaceName,
  spaceKey,
  site = 'lotusflare.atlassian.net',
  catalogPageUrl = '',
}) {
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const title = formatTitle(page.title);
  const confluenceUrl = page.url || `https://${site}/wiki/spaces/${spaceKey}`;
  const mention = handle ? `@${handle}` : contact || 'there';

  return `Hi ${mention},

Could you review this Confluence page? It may need updating, archiving, or deleting:

• *${title}*
• Space: ${spaceName} (${spaceKey})
• Last updated: ${formatDate(page.lastModified)}
${page.lastEditor ? `• Last editor: ${page.lastEditor}\n` : ''}${catalogPageUrl ? `• Catalog: ${catalogPageUrl}\n` : ''}• Confluence: ${confluenceUrl}

Thanks!`;
}

export function resolveSlackUserId(contact, config) {
  if (!contact || !config?.users) return null;
  const users = config.users;
  if (users[contact]) return users[contact];
  const email = guessEmail(contact);
  if (email && users[email]) return users[email];
  const handle = guessSlackHandle(contact);
  if (handle && users[handle]) return users[handle];
  if (handle && users[`@${handle}`]) return users[`@${handle}`];
  return null;
}

/** Build Slack URL — opens DM when user ID is known, else workspace/channel. */
export function buildSlackUrl(contact, config = DEFAULT_SLACK_CONFIG) {
  const userId = resolveSlackUserId(contact, config);
  const teamId = config.teamId?.trim();

  if (userId && teamId) {
    return `https://slack.com/app_redirect?team=${teamId}&channel=${userId}`;
  }

  if (config.fallbackChannelId?.trim() && teamId) {
    return `https://slack.com/app_redirect?team=${teamId}&channel=${config.fallbackChannelId.trim()}`;
  }

  return config.workspaceUrl || DEFAULT_SLACK_CONFIG.workspaceUrl;
}

export async function openSlackReview({
  page,
  spaceName,
  spaceKey,
  site,
  catalogPageUrl,
  slackConfig = DEFAULT_SLACK_CONFIG,
}) {
  const contact = primaryContact(page);
  const message = buildReviewMessage({
    page,
    spaceName,
    spaceKey,
    site,
    catalogPageUrl,
  });
  const url = buildSlackUrl(contact, slackConfig);
  const handle = guessSlackHandle(contact);

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    /* clipboard may be blocked */
  }

  window.open(url, '_blank', 'noopener,noreferrer');

  return {
    contact,
    handle,
    url,
    copied: true,
  };
}

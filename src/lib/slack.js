import { formatTitle, normalizeForSearch } from './text.js';
import { formatDate } from './labels.js';
import { guessEmail, primaryContact } from './contact.js';

function normalizePersonNameForSlack(name) {
  return normalizeForSearch(name)
    .replace(/\s*\(unlicensed\)\s*/gi, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const DEFAULT_SLACK_CONFIG = {
  workspaceUrl: 'https://lotusflare.slack.com',
  teamId: '',
  fallbackChannelId: '',
  users: {},
};

/** Max pages listed in one Slack message (split into multiple messages above this). */
export const REMIND_PAGES_PER_MESSAGE = 12;

export function splitReminderPageChunks(pages, size = REMIND_PAGES_PER_MESSAGE) {
  if (!pages?.length) return [];
  const chunks = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

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
  const resolved = resolveSlackRecipient(contact, config);
  return resolved?.userId || null;
}

/**
 * Resolve Slack member ID for a Confluence display name (strict — avoids short-name collisions).
 */
export function resolveSlackRecipient(contact, config) {
  if (!contact || !config?.users) return null;
  const users = config.users;
  const c = contact.trim();
  if (!c) return null;

  const pick = (userId, matchedAs, matchType) =>
    userId ? { userId, matchedAs, matchType } : null;

  if (users[c]) return pick(users[c], c, 'exact');

  const lower = c.toLowerCase();
  for (const [key, id] of Object.entries(users)) {
    if (key.toLowerCase() === lower) return pick(id, key, 'case-insensitive');
  }

  const norm = normalizePersonNameForSlack(c);
  for (const [key, id] of Object.entries(users)) {
    if (!key.includes(' ')) continue;
    if (normalizePersonNameForSlack(key) === norm) return pick(id, key, 'normalized-name');
  }

  const email = guessEmail(c);
  if (email) {
    if (users[email]) return pick(users[email], email, 'email');
    for (const [key, id] of Object.entries(users)) {
      if (key.toLowerCase() === email) return pick(id, key, 'email');
    }
  }

  const handle = guessSlackHandle(c);
  if (handle) {
    if (users[handle]) return pick(users[handle], handle, 'handle');
    if (users[`@${handle}`]) return pick(users[`@${handle}`], `@${handle}`, 'handle');
  }

  // Single-word keys (e.g. "sam") are export aliases — only match single-word contacts.
  if (!c.includes(' ') && !c.includes('@')) {
    if (users[c]) return pick(users[c], c, 'first-name');
    const handleKey = c.toLowerCase();
    if (users[handleKey]) return pick(users[handleKey], handleKey, 'handle');
  }

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
    message,
    copied: true,
  };
}

export function buildBundledReviewMessage({
  editor,
  pages,
  site = 'lotusflare.atlassian.net',
  partIndex = 1,
  partTotal = 1,
  globalOffset = 0,
}) {
  const contact = editor;
  const handle = guessSlackHandle(contact);
  const mention = handle ? `@${handle}` : contact || 'there';

  const lines = pages.map((page, index) => {
    const title = formatTitle(page.title);
    const confluenceUrl =
      page.url || `https://${site}/wiki/spaces/${page.spaceKey || 'UNKNOWN'}`;
    const status = page.recency === 'legacy' ? 'legacy' : 'stale';
    const n = globalOffset + index + 1;
    return `${n}. *${title}* (${page.spaceName || page.spaceKey}, ${status}, ${formatDate(page.lastModified)})
   ${confluenceUrl}`;
  });

  let body = `Hi ${mention},

I'm reviewing our Confluence documentation catalog. These pages may need updating, archiving, or deleting:`;

  if (partTotal > 1) {
    body += `\n\nPart ${partIndex} of ${partTotal} (${pages.length} page${pages.length === 1 ? '' : 's'} in this message):`;
  }

  body += `

${lines.join('\n\n')}

Thanks!`;
  return body;
}

export async function openBundledSlackReview({
  editor,
  pages,
  site,
  slackConfig = DEFAULT_SLACK_CONFIG,
  partIndex = 1,
  partTotal = 1,
  globalOffset = 0,
}) {
  const message = buildBundledReviewMessage({
    editor,
    pages,
    site,
    partIndex,
    partTotal,
    globalOffset,
  });
  const url = buildSlackUrl(editor, slackConfig);
  const handle = guessSlackHandle(editor);

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    /* clipboard may be blocked */
  }

  window.open(url, '_blank', 'noopener,noreferrer');

  return { contact: editor, handle, url, message, copied: true };
}

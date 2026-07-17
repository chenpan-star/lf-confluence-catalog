import { formatTitle } from './text.js';
import { formatDate } from './labels.js';
import { guessEmail, primaryContact } from './contact.js';

export const DEFAULT_SLACK_CONFIG = {
  workspaceUrl: 'https://lotusflare.slack.com',
  teamId: '',
  fallbackChannelId: '',
  users: {},
  /** Cloudflare Worker URL for bot DMs, e.g. https://lf-confluence-slack-remind….workers.dev */
  remindApiUrl: '',
};

/** Resolve remind API URL: Vite env wins, then slack.json. */
export function getRemindApiUrl(slackConfig = DEFAULT_SLACK_CONFIG) {
  const fromEnv = (import.meta.env.VITE_REMIND_API_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return (slackConfig.remindApiUrl || '').trim().replace(/\/$/, '');
}

/** Shared key sent as X-Remind-Key — never commit the real value. */
export function getRemindApiKey() {
  return (import.meta.env.VITE_REMIND_API_KEY || '').trim();
}

export function isBotRemindConfigured(slackConfig = DEFAULT_SLACK_CONFIG) {
  return Boolean(getRemindApiUrl(slackConfig) && getRemindApiKey());
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

/**
 * Send a reminder DM via the Cloudflare Worker (Slack bot).
 * @returns {{ ok: true, email?: string } | { ok: false, error: string, fallback?: boolean }}
 */
export async function sendSlackReminderViaBot({
  contactName,
  message,
  pageTitle = '',
  spaceName = '',
  spaceKey = '',
  confluenceUrl = '',
  catalogPageUrl = '',
  email = '',
  slackConfig = DEFAULT_SLACK_CONFIG,
}) {
  const apiUrl = getRemindApiUrl(slackConfig);
  const apiKey = getRemindApiKey();

  if (!apiUrl || !apiKey) {
    return { ok: false, error: 'Remind API not configured', fallback: true };
  }

  const name = (contactName || '').trim();
  if (!name) {
    return { ok: false, error: 'No recipient for this reminder' };
  }

  try {
    const res = await fetch(`${apiUrl}/api/slack/remind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Remind-Key': apiKey,
      },
      body: JSON.stringify({
        contactName: name,
        email: email || guessEmail(name) || '',
        message,
        pageTitle,
        spaceName,
        spaceKey,
        confluenceUrl,
        catalogPageUrl,
      }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || `Remind API error (${res.status})`,
        fallback: res.status === 404 || res.status >= 500,
      };
    }

    return { ok: true, email: data.email };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Network error talking to remind API',
      fallback: true,
    };
  }
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
  maxPages = 15,
}) {
  const contact = editor;
  const handle = guessSlackHandle(contact);
  const mention = handle ? `@${handle}` : contact || 'there';
  const shown = pages.slice(0, maxPages);
  const remaining = pages.length - shown.length;

  const lines = shown.map((page, index) => {
    const title = formatTitle(page.title);
    const confluenceUrl =
      page.url || `https://${site}/wiki/spaces/${page.spaceKey || 'UNKNOWN'}`;
    const status = page.recency === 'legacy' ? 'legacy' : 'stale';
    return `${index + 1}. *${title}* (${page.spaceName || page.spaceKey}, ${status}, ${formatDate(page.lastModified)})
   ${confluenceUrl}`;
  });

  let body = `Hi ${mention},

I'm reviewing our Confluence documentation catalog. These pages may need updating, archiving, or deleting:

${lines.join('\n\n')}`;

  if (remaining > 0) {
    body += `\n\n…and ${remaining} more stale page(s) assigned to you in the catalog.`;
  }

  body += '\n\nThanks!';
  return body;
}

export async function openBundledSlackReview({
  editor,
  pages,
  site,
  slackConfig = DEFAULT_SLACK_CONFIG,
  maxPages = 15,
}) {
  const message = buildBundledReviewMessage({ editor, pages, site, maxPages });
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

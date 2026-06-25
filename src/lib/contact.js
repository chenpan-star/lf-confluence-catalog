import { formatTitle } from './text.js';
import { formatDate } from './labels.js';

const DEFAULT_DOMAIN = 'lotusflare.com';

/** Best-effort email from Confluence display name (lotusflare.com pattern). */
export function guessEmail(name, domain = DEFAULT_DOMAIN) {
  if (!name) return null;
  const raw = name.replace(/\s*\(unlicensed\)\s*/gi, '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw.toLowerCase();

  if (/^[a-z0-9._-]+$/i.test(raw) && raw.includes('.')) {
    return `${raw.toLowerCase()}@${domain}`;
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (first && last) return `${first}.${last}@${domain}`;
  }

  return null;
}

export function primaryContact(page) {
  return page.lastEditor || page.creator || '';
}

/**
 * mailto link asking creator/editor to review, update, archive, or delete.
 */
export function buildReviewMailto({
  page,
  spaceName,
  spaceKey,
  site = 'lotusflare.atlassian.net',
  catalogPageUrl = '',
}) {
  const contact = primaryContact(page);
  const email = guessEmail(contact);
  const title = formatTitle(page.title);
  const confluenceUrl = page.url || `https://${site}/wiki/spaces/${spaceKey}`;

  const subject = `Confluence page review: ${title}`;
  const body = `Hi${contact ? ` ${contact.split(' ')[0]}` : ''},

I'm reviewing our Confluence documentation catalog and this page may need attention:

Page: ${title}
Space: ${spaceName} (${spaceKey})
Last updated: ${formatDate(page.lastModified)}
${page.creator ? `Created by: ${page.creator}\n` : ''}${page.lastEditor ? `Last edited by: ${page.lastEditor}\n` : ''}${catalogPageUrl ? `Catalog link: ${catalogPageUrl}\n` : ''}Confluence link: ${confluenceUrl}

Could you please review this page and update, archive, or delete it if it's no longer needed?

Thank you!`;

  const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (email) return `mailto:${email}?${qs}`;
  return `mailto:?${qs}`;
}

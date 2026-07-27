import { formatTitle } from './text.js';
import { formatDate } from './labels.js';
import { personMatchesQuery } from './personSearch.js';

const DEFAULT_DOMAIN = 'lotusflare.com';

const BOT_PATTERNS = [
  /automation/i,
  /release note/i,
  /standup helper/i,
  /oncall automation/i,
  /^cs automation$/i,
  /^dno release note$/i,
];

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

export function isAnonymousEditor(name) {
  return /^(anonymous|unknown)$/i.test((name || '').trim());
}

export function isBotEditor(name) {
  const n = (name || '').trim();
  if (!n) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(n));
}

/** Last editor cannot be contacted (Anonymous, bot, missing, etc.). */
export function isUnreachableEditor(name) {
  const n = (name || '').trim();
  if (!n) return true;
  return isAnonymousEditor(n) || isBotEditor(n);
}

/** Raw last editor value from Confluence (may be Anonymous). */
export function lastEditorLabel(page) {
  return (page?.lastEditor || '').trim();
}

/**
 * Person responsible for a page: last editor when reachable, otherwise creator.
 */
export function accountablePerson(page) {
  const editor = lastEditorLabel(page);
  if (editor && !isUnreachableEditor(editor)) return editor;
  return (page?.creator || '').trim() || editor;
}

/** Whether contact comes from creator because the last editor was unreachable. */
export function usesCreatorFallback(page) {
  const editor = lastEditorLabel(page);
  if (!editor || !isUnreachableEditor(editor)) return false;
  return Boolean((page?.creator || '').trim());
}

/** Best person to contact for reminders (same as accountablePerson). */
export function primaryContact(page) {
  return accountablePerson(page);
}

/**
 * Match a person filter against a page.
 * When fallbackToCreator is true (default), unreachable last editors use creator instead.
 */
export function pageMatchesAccountableQuery(query, page, { fallbackToCreator = true } = {}) {
  if (!query?.trim()) return true;

  const editor = lastEditorLabel(page);

  if (!fallbackToCreator) {
    return personMatchesQuery(query, editor);
  }

  if (editor && !isUnreachableEditor(editor)) {
    return personMatchesQuery(query, editor);
  }

  const creator = (page?.creator || '').trim();
  if (creator) return personMatchesQuery(query, creator);

  return personMatchesQuery(query, editor);
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

export function buildBundledReviewMailto({
  editor,
  pages,
  site = 'lotusflare.atlassian.net',
  partIndex = 1,
  partTotal = 1,
  globalOffset = 0,
}) {
  const email = guessEmail(editor);
  const contact = editor;

  const subject =
    partTotal > 1
      ? `Confluence review (part ${partIndex}/${partTotal}): ${pages.length} page(s)`
      : `Confluence review: ${pages.length} page(s) need attention`;

  const lines = pages.map((page, index) => {
    const title = formatTitle(page.title);
    const confluenceUrl =
      page.url || `https://${site}/wiki/spaces/${page.spaceKey || 'UNKNOWN'}`;
    const n = globalOffset + index + 1;
    return `${n}. ${title}
   Space: ${page.spaceName} (${page.spaceKey})
   Last updated: ${formatDate(page.lastModified)}
   ${confluenceUrl}`;
  });

  let body = `Hi${contact ? ` ${contact.split(' ')[0]}` : ''},

I'm reviewing our Confluence documentation catalog. These pages may need updating, archiving, or deleting:`;

  if (partTotal > 1) {
    body += `\n\nPart ${partIndex} of ${partTotal}:`;
  }

  body += `

${lines.join('\n\n')}

Thank you!`;

  const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (email) return `mailto:${email}?${qs}`;
  return `mailto:?${qs}`;
}

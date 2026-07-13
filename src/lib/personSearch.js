import { normalizeForSearch } from './text.js';
import { guessEmail } from './contact.js';
import { guessSlackHandle } from './slack.js';

/** Strip accents, unlicensed suffix, and normalize spacing for person matching. */
export function normalizePersonName(name) {
  return normalizeForSearch(name)
    .replace(/\s*\(unlicensed\)\s*/gi, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Query tokens for person matching (handles emails and handles). */
export function personQueryTerms(query) {
  const raw = (query || '').trim();
  if (!raw) return [];

  if (raw.includes('@')) {
    const local = raw.split('@')[0];
    return normalizePersonName(local).split(/\s+/).filter(Boolean);
  }

  return normalizePersonName(raw).split(/\s+/).filter(Boolean);
}

/** True when two Confluence display names refer to the same person. */
export function editorsAreSamePerson(a, b) {
  if (!a?.trim() || !b?.trim()) return false;
  if (a.trim() === b.trim()) return true;
  return normalizePersonName(a) === normalizePersonName(b);
}

/** Searchable tokens derived from a Confluence display name or handle. */
export function personSearchTerms(name) {
  const raw = (name || '').trim();
  if (!raw) return [];

  const terms = new Set();
  const stripped = raw.replace(/\s*\(unlicensed\)\s*/gi, '').trim();

  terms.add(normalizePersonName(raw));
  terms.add(normalizeForSearch(stripped));

  const handle = guessSlackHandle(raw);
  if (handle) {
    terms.add(normalizeForSearch(handle));
    terms.add(normalizeForSearch(handle.replace(/\./g, ' ')));
  }

  const email = guessEmail(raw);
  if (email) {
    terms.add(normalizeForSearch(email));
    const local = email.split('@')[0];
    terms.add(normalizeForSearch(local));
    terms.add(normalizeForSearch(local.replace(/\./g, ' ')));
  }

  for (const part of normalizePersonName(raw).split(/\s+/)) {
    if (part.length >= 2) terms.add(part);
  }

  return [...terms].filter(Boolean);
}

/** Build a single haystack string for indexing or filtering. */
export function personSearchHaystack(...names) {
  return names.flatMap(personSearchTerms).join(' ');
}

/** True when every query term appears in any variant of the given names. */
export function personMatchesQuery(query, ...names) {
  if (!query?.trim()) return true;
  const haystack = personSearchHaystack(...names);
  if (!haystack) return false;
  const qTerms = personQueryTerms(query);
  if (!qTerms.length) return true;
  return qTerms.every((term) => haystack.includes(term));
}

export function pageMatchesPersonQuery(query, page) {
  if (!query?.trim()) return true;
  return personMatchesQuery(query, page?.lastEditor, page?.creator);
}

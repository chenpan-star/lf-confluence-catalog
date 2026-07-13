/** Decode common HTML entities in Confluence titles. */
export function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function formatTitle(text) {
  return decodeHtmlEntities(text || '').trim() || 'Untitled';
}

/** Normalize text for case-insensitive search (strips accents and extra spaces). */
export function normalizeForSearch(text) {
  return decodeHtmlEntities(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

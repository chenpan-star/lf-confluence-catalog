import { normalizeForSearch } from './text.js';
import { pageMatchesAccountableQuery } from './contact.js';

/** Aggregate freshness stats and stale page lists from catalog data. */
export function computeHealthStats(catalog) {
  const counts = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
  const stalePages = [];
  const byCategory = {};

  if (!catalog?.spaces) {
    return { counts, stalePages, byCategory, needsAttention: 0, total: 0 };
  }

  for (const space of catalog.spaces) {
    const catId = space.category || 'misc';
    if (!byCategory[catId]) {
      byCategory[catId] = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
    }

    for (const page of space.pages || []) {
      const r = page.recency || 'unknown';
      counts[r] = (counts[r] || 0) + 1;
      byCategory[catId][r] = (byCategory[catId][r] || 0) + 1;

      if (r === 'stale' || r === 'legacy') {
        stalePages.push({
          ...page,
          spaceKey: space.key,
          spaceName: space.name,
          spaceCategory: space.category,
        });
      }
    }
  }

  stalePages.sort((a, b) => (a.lastModified || '').localeCompare(b.lastModified || ''));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    counts,
    stalePages,
    byCategory,
    needsAttention: counts.stale + counts.legacy,
    total,
  };
}

export function filterStalePages(
  stalePages,
  { category, recency, query, personQuery, spaceKey, fallbackToCreator = true } = {},
) {
  let list = stalePages;

  if (category && category !== 'all') {
    list = list.filter((p) => p.spaceCategory === category);
  }
  if (recency && recency !== 'all') {
    list = list.filter((p) => p.recency === recency);
  }
  if (spaceKey && spaceKey !== 'all') {
    list = list.filter((p) => p.spaceKey === spaceKey);
  }
  if (personQuery?.trim()) {
    list = list.filter((p) =>
      pageMatchesAccountableQuery(personQuery, p, { fallbackToCreator }),
    );
  }
  if (query?.trim()) {
    const q = normalizeForSearch(query);
    list = list.filter(
      (p) =>
        normalizeForSearch(p.title || '').includes(q) ||
        normalizeForSearch(p.spaceName || '').includes(q) ||
        normalizeForSearch(p.spaceKey || '').includes(q),
    );
  }

  return list;
}

/** Group stale pages by category id for sectioned display. */
export function groupStalePagesByCategory(stalePages, categoryOrder = []) {
  const groups = new Map();
  for (const page of stalePages) {
    const catId = page.spaceCategory || 'misc';
    if (!groups.has(catId)) groups.set(catId, []);
    groups.get(catId).push(page);
  }

  const ordered = [];
  const seen = new Set();
  for (const id of categoryOrder) {
    if (groups.has(id)) {
      ordered.push({ categoryId: id, pages: groups.get(id) });
      seen.add(id);
    }
  }
  for (const [id, pages] of groups) {
    if (!seen.has(id)) ordered.push({ categoryId: id, pages });
  }
  return ordered;
}

import { normalizeForSearch } from './text.js';
import { personSearchHaystack } from './personSearch.js';

/**
 * Pre-build a flat search index from catalog data.
 */
export function buildSearchIndex(catalog) {
  if (!catalog?.spaces) return [];

  const items = [];

  for (const space of catalog.spaces) {
    const catLabel = catalog.categories?.[space.category]?.label || '';

    items.push({
      type: 'space',
      key: `space-${space.key}`,
      title: space.name,
      subtitle: [space.key, catLabel].filter(Boolean).join(' · '),
      path: `/space/${encodeURIComponent(space.key)}`,
      haystack: normalizeForSearch(`${space.name} ${space.key} ${catLabel}`),
      score: 0,
    });

    for (const page of space.pages || []) {
      const title = page.title || '';
      const contactHaystack = personSearchHaystack(page.creator, page.lastEditor);
      items.push({
        type: 'page',
        key: `page-${page.id || page.url}`,
        title,
        subtitle: [space.name, catLabel].filter(Boolean).join(' · '),
        path: page.id
          ? `/spaces/${encodeURIComponent(space.key)}/pages/${page.id}`
          : null,
        url: page.url,
        spaceKey: space.key,
        spaceName: space.name,
        haystack: normalizeForSearch(
          `${title} ${space.name} ${space.key} ${page.parentTitle || ''} ${page.creator || ''} ${page.lastEditor || ''} ${catLabel} ${contactHaystack}`,
        ),
        page,
        score: 0,
      });
    }
  }

  return items;
}

function scoreItem(item, query, terms) {
  let score = 0;
  const title = normalizeForSearch(item.title);
  const haystack = item.haystack;

  if (title === query) score += 200;
  else if (title.startsWith(query)) score += 120;
  else if (title.includes(query)) score += 60;

  if (item.type === 'space' && haystack.includes(query)) score += 40;

  for (const term of terms) {
    if (title === term) score += 30;
    else if (title.startsWith(term)) score += 15;
    else if (haystack.includes(term)) score += 5;
  }

  // Boost person-name matches on pages
  if (item.type === 'page' && item.page) {
    const contactHaystack = personSearchHaystack(item.page.creator, item.page.lastEditor);
    if (contactHaystack.includes(query)) score += 80;
    for (const term of terms) {
      if (contactHaystack.includes(term)) score += 25;
    }
  }

  return score;
}

/**
 * Search the pre-built index. All query terms must match (AND).
 */
export function searchCatalog(index, rawQuery) {
  const query = normalizeForSearch(rawQuery);
  if (!query || !index.length) {
    return { spaces: [], pages: [], query: rawQuery.trim(), totalMatches: 0 };
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = [];

  for (const item of index) {
    if (!terms.every((term) => item.haystack.includes(term))) continue;
    matches.push({ ...item, score: scoreItem(item, query, terms) });
  }

  matches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return {
    query: rawQuery.trim(),
    spaces: matches.filter((m) => m.type === 'space'),
    pages: matches.filter((m) => m.type === 'page'),
    totalMatches: matches.length,
  };
}

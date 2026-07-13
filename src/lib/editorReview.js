import {
  accountablePerson,
  isBotEditor,
  lastEditorLabel,
  pageMatchesAccountableQuery,
  primaryContact,
} from './contact.js';
import { guessSlackHandle } from './slack.js';
import { normalizeForSearch } from './text.js';
import { pageMatchesPersonQuery, personMatchesQuery, editorsAreSamePerson } from './personSearch.js';

export const EDITOR_REVIEW_MAX_BUNDLE = 15;

export function normalizeEditorName(name) {
  return (name || '').trim();
}

export { isBotEditor };

export function matchEditorName(contact, filter) {
  if (!filter?.trim() || !contact) return false;
  return personMatchesQuery(filter, contact);
}

export function matchEditorExactly(contact, editor) {
  if (!editor?.trim() || !contact) return false;
  return editorsAreSamePerson(contact, editor);
}

export function groupStalePagesByEditor(stalePages, { hideBots = true } = {}) {
  const groups = new Map();
  let botPageCount = 0;

  for (const page of stalePages) {
    const editor = normalizeEditorName(primaryContact(page));
    if (!editor) continue;
    if (hideBots && isBotEditor(editor)) {
      botPageCount += 1;
      continue;
    }

    if (!groups.has(editor)) {
      groups.set(editor, {
        editor,
        slackHandle: guessSlackHandle(editor),
        pages: [],
        staleCount: 0,
        legacyCount: 0,
        topSpaces: new Map(),
      });
    }

    const group = groups.get(editor);
    group.pages.push(page);
    if (page.recency === 'legacy') group.legacyCount += 1;
    else group.staleCount += 1;
    const sk = page.spaceKey || page.spaceName;
    group.topSpaces.set(sk, (group.topSpaces.get(sk) || 0) + 1);
  }

  const groupsList = Array.from(groups.values()).map((g) => {
    g.pages.sort((a, b) => (a.lastModified || '').localeCompare(b.lastModified || ''));
    g.totalStale = g.staleCount + g.legacyCount;
    g.topSpaceLabels = [...g.topSpaces.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => {
        const page = g.pages.find((p) => p.spaceKey === key);
        return page?.spaceName || key;
      });
    delete g.topSpaces;
    return g;
  });

  return { groups: groupsList, botPageCount };
}

export function sortEditorGroups(groups, sortBy = 'most-stale') {
  const copy = [...groups];
  if (sortBy === 'name') {
    return copy.sort((a, b) => a.editor.localeCompare(b.editor));
  }
  if (sortBy === 'oldest') {
    return copy.sort((a, b) => {
      const aOldest = a.pages[0]?.lastModified || '';
      const bOldest = b.pages[0]?.lastModified || '';
      return aOldest.localeCompare(bOldest);
    });
  }
  return copy.sort(
    (a, b) => b.totalStale - a.totalStale || a.editor.localeCompare(b.editor),
  );
}

export function applyEditorGroupFilters(
  groups,
  { query, recency, spaceKey, editorQuery } = {},
) {
  return groups
    .map((group) => {
      if (editorQuery?.trim()) {
        const matchesEditor =
          personMatchesQuery(editorQuery, group.editor) ||
          (group.slackHandle && personMatchesQuery(editorQuery, group.slackHandle));
        if (!matchesEditor) return null;
      }

      let pages = group.pages;
      if (recency && recency !== 'all') {
        pages = pages.filter((p) => p.recency === recency);
      }
      if (spaceKey && spaceKey !== 'all') {
        pages = pages.filter((p) => p.spaceKey === spaceKey);
      }
      if (query?.trim()) {
        const q = normalizeForSearch(query);
        pages = pages.filter(
          (p) =>
            normalizeForSearch(p.title || '').includes(q) ||
            normalizeForSearch(p.spaceName || '').includes(q) ||
            normalizeForSearch(p.spaceKey || '').includes(q) ||
            pageMatchesPersonQuery(query, p),
        );
      }
      if (!pages.length) return null;

      const staleCount = pages.filter((p) => p.recency === 'stale').length;
      const legacyCount = pages.filter((p) => p.recency === 'legacy').length;
      return {
        ...group,
        pages,
        staleCount,
        legacyCount,
        totalStale: staleCount + legacyCount,
      };
    })
    .filter(Boolean);
}

export function collectPagesForEditor(
  catalog,
  editorFilter,
  { staleOnly = false, exact = true, fallbackToCreator = true } = {},
) {
  if (!catalog?.spaces || !editorFilter?.trim()) return [];

  const pages = [];
  for (const space of catalog.spaces) {
    for (const page of space.pages || []) {
      if (!pageMatchesAccountableQuery(editorFilter, page, { fallbackToCreator })) continue;

      const person = fallbackToCreator ? accountablePerson(page) : lastEditorLabel(page);
      const matches = exact
        ? matchEditorExactly(person, editorFilter)
        : matchEditorName(person, editorFilter);
      if (!matches) continue;
      if (staleOnly && page.recency !== 'stale' && page.recency !== 'legacy') continue;
      pages.push({
        ...page,
        spaceKey: space.key,
        spaceName: space.name,
        department: space.department || 'needs-owner',
        spaceCategory: space.category,
      });
    }
  }

  pages.sort((a, b) => (a.lastModified || '').localeCompare(b.lastModified || ''));
  return pages;
}

/** Unique editors in the catalog whose name matches the query. */
export function findMatchingEditors(catalog, query, { staleOnly = false, fallbackToCreator = true } = {}) {
  if (!catalog?.spaces || !query?.trim()) return [];

  const byEditor = new Map();

  for (const space of catalog.spaces) {
    for (const page of space.pages || []) {
      if (!pageMatchesAccountableQuery(query, page, { fallbackToCreator })) continue;
      if (staleOnly && page.recency !== 'stale' && page.recency !== 'legacy') continue;

      const editor = normalizeEditorName(
        fallbackToCreator ? accountablePerson(page) : lastEditorLabel(page),
      );
      if (!editor) continue;

      if (!byEditor.has(editor)) {
        byEditor.set(editor, {
          editor,
          slackHandle: guessSlackHandle(editor),
          total: 0,
          needsAttention: 0,
        });
      }
      const row = byEditor.get(editor);
      row.total += 1;
      if (page.recency === 'stale' || page.recency === 'legacy') row.needsAttention += 1;
    }
  }

  return [...byEditor.values()].sort(
    (a, b) => b.needsAttention - a.needsAttention || a.editor.localeCompare(b.editor),
  );
}

/** All distinct accountable people in the catalog (for autocomplete). */
export function listCatalogEditors(catalog, { fallbackToCreator = true } = {}) {
  if (!catalog?.spaces) return [];
  const editors = new Set();
  for (const space of catalog.spaces) {
    for (const page of space.pages || []) {
      const editor = normalizeEditorName(
        fallbackToCreator ? accountablePerson(page) : lastEditorLabel(page),
      );
      if (editor) editors.add(editor);
    }
  }
  return [...editors].sort((a, b) => a.localeCompare(b));
}

export function summarizeEditorPages(pages) {
  const stale = pages.filter((p) => p.recency === 'stale').length;
  const legacy = pages.filter((p) => p.recency === 'legacy').length;
  const attention = pages.filter((p) => p.recency === 'stale' || p.recency === 'legacy');
  return {
    total: pages.length,
    stale,
    legacy,
    needsAttention: stale + legacy,
    attentionPages: attention,
    recentPages: pages.filter((p) => p.recency !== 'stale' && p.recency !== 'legacy'),
  };
}

import { primaryContact } from './contact.js';
import { guessSlackHandle } from './slack.js';

const BOT_PATTERNS = [
  /automation/i,
  /release note/i,
  /standup helper/i,
  /oncall automation/i,
  /^cs automation$/i,
  /^dno release note$/i,
];

export const EDITOR_REVIEW_MAX_BUNDLE = 15;

export function normalizeEditorName(name) {
  return (name || '').trim();
}

export function isBotEditor(name) {
  const n = normalizeEditorName(name);
  if (!n) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(n));
}

export function matchEditorName(contact, filter) {
  if (!filter?.trim() || !contact) return false;
  const f = filter.trim().toLowerCase();
  const c = normalizeEditorName(contact).toLowerCase();
  if (c === f) return true;
  const handle = guessSlackHandle(contact);
  if (handle && handle === f) return true;
  if (c.replace(/\s*\(unlicensed\)\s*/gi, '') === f) return true;
  return c.includes(f);
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
        const q = editorQuery.trim().toLowerCase();
        const matchesEditor =
          group.editor.toLowerCase().includes(q) ||
          (group.slackHandle && group.slackHandle.includes(q));
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
        const q = query.trim().toLowerCase();
        pages = pages.filter(
          (p) =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.spaceName || '').toLowerCase().includes(q) ||
            (p.spaceKey || '').toLowerCase().includes(q),
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

export function collectPagesForEditor(catalog, editorFilter, { staleOnly = false } = {}) {
  if (!catalog?.spaces || !editorFilter?.trim()) return [];

  const pages = [];
  for (const space of catalog.spaces) {
    for (const page of space.pages || []) {
      if (!matchEditorName(primaryContact(page), editorFilter)) continue;
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

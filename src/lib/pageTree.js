/**
 * Build a page tree from a flat page list (within one space).
 * Returns roots sorted by title; each node has { page, children }.
 */
export function buildPageTree(pages) {
  const byId = new Map();
  for (const page of pages) {
    if (page.id) byId.set(page.id, page);
  }

  const childrenByParent = new Map();
  const roots = [];

  for (const page of pages) {
    const parentId = page.parentId || '';
    if (!parentId || !byId.has(parentId)) {
      roots.push(page);
    } else {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(page);
    }
  }

  function sortPages(list) {
    return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  function toNode(page) {
    const kids = sortPages(childrenByParent.get(page.id) || []);
    return {
      page,
      children: kids.map(toNode),
    };
  }

  return sortPages(roots).map(toNode);
}

/** Filter flat pages; keeps pages matching filter and their ancestors for tree context. */
export function filterPagesWithAncestors(pages, predicate) {
  const byId = new Map(pages.filter((p) => p.id).map((p) => [p.id, p]));
  const included = new Set();

  for (const page of pages) {
    if (!predicate(page)) continue;
    included.add(page.id || page.url);
    let pid = page.parentId;
    while (pid && byId.has(pid)) {
      included.add(pid);
      pid = byId.get(pid).parentId;
    }
  }

  return pages.filter((p) => included.has(p.id || p.url));
}

export function catalogPagePath(url) {
  const m = url?.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (!m) return null;
  return `/spaces/${m[1]}/pages/${m[2]}`;
}

/** In-app path for a page — prefers page id (works for overview/homepage URLs too). */
export function pageCatalogPath(page, spaceKey, context) {
  const ctx = typeof context === 'object' && context ? context : {};
  const key = spaceKey || page?.spaceKey;
  if (page?.id && key) {
    if (ctx.categoryId) {
      return `/category/${ctx.categoryId}/space/${encodeURIComponent(key)}/pages/${page.id}`;
    }
    return `/spaces/${encodeURIComponent(key)}/pages/${page.id}`;
  }
  return catalogPagePath(page?.url);
}

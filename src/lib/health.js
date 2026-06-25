/** Aggregate freshness stats and stale page lists from catalog data. */
export function computeHealthStats(catalog) {
  const counts = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
  const stalePages = [];
  const byDepartment = {};

  if (!catalog?.spaces) {
    return { counts, stalePages, byDepartment, needsAttention: 0, total: 0 };
  }

  for (const space of catalog.spaces) {
    const deptId = space.department || 'needs-owner';
    if (!byDepartment[deptId]) {
      byDepartment[deptId] = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
    }

    for (const page of space.pages || []) {
      const r = page.recency || 'unknown';
      counts[r] = (counts[r] || 0) + 1;
      byDepartment[deptId][r] = (byDepartment[deptId][r] || 0) + 1;

      if (r === 'stale' || r === 'legacy') {
        stalePages.push({
          ...page,
          spaceKey: space.key,
          spaceName: space.name,
          department: deptId,
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
    byDepartment,
    needsAttention: counts.stale + counts.legacy,
    total,
  };
}

export function filterStalePages(stalePages, { department, recency, query, spaceKey } = {}) {
  let list = stalePages;

  if (department && department !== 'all') {
    list = list.filter((p) => p.department === department);
  }
  if (recency && recency !== 'all') {
    list = list.filter((p) => p.recency === recency);
  }
  if (spaceKey && spaceKey !== 'all') {
    list = list.filter((p) => p.spaceKey === spaceKey);
  }
  if (query?.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.spaceName || '').toLowerCase().includes(q) ||
        (p.spaceKey || '').toLowerCase().includes(q) ||
        (p.creator || '').toLowerCase().includes(q) ||
        (p.lastEditor || '').toLowerCase().includes(q),
    );
  }

  return list;
}

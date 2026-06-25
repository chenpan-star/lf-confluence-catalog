/**
 * Build contributor stats from Confluence page metadata (no HR/Zoho required).
 * Department assignment works at SPACE level; pages inherit from their space.
 */

const SKIP_NAMES = /^(anonymous|unknown)$/i;

export function isValidContributor(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || SKIP_NAMES.test(t)) return false;
  return true;
}

/** @returns {Map<string, { name, totalEdits, spaces: Map<string, { spaceKey, spaceName, edits }> }>} */
export function buildContributorStats(rawPages) {
  const contributors = new Map();

  for (const p of rawPages) {
    const spaceKey = p.spaceKey || p.spaceName || '';
    const spaceName = p.spaceName || spaceKey;
    for (const person of [p.lastEditor, p.creator]) {
      if (!isValidContributor(person)) continue;
      if (!contributors.has(person)) {
        contributors.set(person, { name: person, totalEdits: 0, spaces: new Map() });
      }
      const c = contributors.get(person);
      c.totalEdits += 1;
      const sk = spaceKey || 'unknown';
      if (!c.spaces.has(sk)) {
        c.spaces.set(sk, { spaceKey: sk, spaceName, edits: 0 });
      }
      c.spaces.get(sk).edits += 1;
    }
  }

  return contributors;
}

/**
 * Infer a contributor's primary department from spaces they edit
 * (uses already-assigned space departments, not HR data).
 */
export function inferContributorDepartment(contributor, spaceDeptMap, contributorOverrides = {}) {
  if (contributorOverrides[contributor.name]) {
    return {
      departmentId: contributorOverrides[contributor.name],
      source: 'manual',
      confidence: 100,
      breakdown: {},
    };
  }

  const breakdown = new Map();
  for (const [, sp] of contributor.spaces) {
    const dept = spaceDeptMap.get(sp.spaceKey);
    if (!dept || dept === 'needs-owner') continue;
    breakdown.set(dept, (breakdown.get(dept) || 0) + sp.edits);
  }

  if (!breakdown.size) {
    return { departmentId: null, source: 'unknown', confidence: 0, breakdown: {} };
  }

  let bestId = null;
  let bestCount = 0;
  let total = 0;
  for (const [id, count] of breakdown) {
    total += count;
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }

  return {
    departmentId: bestId,
    source: 'activity',
    confidence: total ? Math.round((bestCount / total) * 100) : 0,
    breakdown: Object.fromEntries(breakdown),
  };
}

/**
 * For an unassigned space: vote department from where its top editors also work.
 */
export function inferDepartmentFromContributorNetwork(spaceKey, spacePages, contributorStats, spaceDeptMap) {
  const votes = new Map();
  const editorHits = new Map();

  for (const page of spacePages) {
    for (const person of [page.lastEditor, page.creator]) {
      if (!isValidContributor(person)) continue;
      const contributor = contributorStats.get(person);
      if (!contributor) continue;

      editorHits.set(person, (editorHits.get(person) || 0) + 1);

      for (const [sk, sp] of contributor.spaces) {
        if (sk === spaceKey) continue;
        const dept = spaceDeptMap.get(sk);
        if (!dept || dept === 'needs-owner') continue;
        votes.set(dept, (votes.get(dept) || 0) + sp.edits);
      }
    }
  }

  if (!votes.size) return null;

  let bestId = null;
  let bestCount = 0;
  let total = 0;
  for (const [id, count] of votes) {
    total += count;
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }

  const confidence = total ? Math.round((bestCount / total) * 100) : 0;
  if (confidence < 40) return null;

  const topEditors = [...editorHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, edits]) => ({ name, edits }));

  return {
    departmentId: bestId,
    confidence,
    voteBreakdown: Object.fromEntries(votes),
    topEditors,
  };
}

/** Export top contributors for catalog.json */
export function buildContributorsCatalog(contributorStats, spaceDeptMap, contributorOverrides = {}, limit = 150) {
  const list = [...contributorStats.values()]
    .sort((a, b) => b.totalEdits - a.totalEdits)
    .slice(0, limit)
    .map((c) => {
      const dept = inferContributorDepartment(c, spaceDeptMap, contributorOverrides);
      const topSpaces = [...c.spaces.values()]
        .sort((a, b) => b.edits - a.edits)
        .slice(0, 8)
        .map((sp) => ({
          spaceKey: sp.spaceKey,
          spaceName: sp.spaceName,
          edits: sp.edits,
          department: spaceDeptMap.get(sp.spaceKey) || 'needs-owner',
        }));

      return {
        name: c.name,
        totalEdits: c.totalEdits,
        spaceCount: c.spaces.size,
        inferredDepartment: dept.departmentId,
        departmentConfidence: dept.confidence,
        departmentSource: dept.source,
        departmentBreakdown: dept.breakdown,
        topSpaces,
      };
    });

  return list;
}

/**
 * Build public/data/catalog.json from raw pages export.
 * Usage: node scripts/generate-catalog.js [path-to-raw-pages.json]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CATEGORIES, spaceCategory, docType, recency } from './lib/classify.js';
import {
  DEPARTMENT_ORDER,
  getDepartmentDefinitions,
  loadDepartmentConfig,
  resolveSpaceDepartment,
} from './lib/department.js';
import { buildEmployeeIndex } from './lib/zoho-match.js';
import {
  buildContributorStats,
  inferDepartmentFromContributorNetwork,
  buildContributorsCatalog,
} from './lib/confluence-contributors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultInput = join(__dirname, '../data/raw-pages.json');
const zohoInput = join(__dirname, '../data/zoho-employees.json');
const inputPath = process.argv[2] || defaultInput;
const outputPath = join(__dirname, '../public/data/catalog.json');

if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  console.error('Run: npm run fetch   (or npm run refresh)');
  process.exit(1);
}

const pages = JSON.parse(readFileSync(inputPath, 'utf8'));
const dataSource = process.env.CATALOG_DATA_SOURCE || 'live';
const fetchedAt = process.env.CATALOG_FETCHED_AT || '';

let employeeIndex = null;
let zohoEmployeeCount = 0;
if (existsSync(zohoInput)) {
  try {
    const zoho = JSON.parse(readFileSync(zohoInput, 'utf8'));
    const employees = zoho.employees || [];
    zohoEmployeeCount = employees.length;
    if (employees.length) employeeIndex = buildEmployeeIndex(employees);
  } catch {
    /* ignore */
  }
}
const existingCatalogPath = outputPath;
let previousRefreshedAt = '';
if (existsSync(existingCatalogPath)) {
  try {
    previousRefreshedAt = JSON.parse(readFileSync(existingCatalogPath, 'utf8')).meta?.refreshedAt || '';
  } catch {
    /* ignore corrupt existing catalog */
  }
}

const spaces = new Map();

for (const p of pages) {
  const sn = p.spaceName || '';
  const sk = p.spaceKey || '';
  const sid = sk || sn;
  if (!spaces.has(sid)) {
    const category = spaceCategory(sn, sk);
    spaces.set(sid, {
      name: sn,
      key: sk,
      category,
      department: 'needs-owner',
      departmentSource: 'heuristic',
      pageCount: 0,
      docTypes: {},
      recency: {},
      pages: [],
    });
  }
  const s = spaces.get(sid);
  const dt = docType(p.title || '', p.excerpt || '');
  const rc = recency(p.lastModified);
  s.pageCount += 1;
  s.docTypes[dt] = (s.docTypes[dt] || 0) + 1;
  s.recency[rc] = (s.recency[rc] || 0) + 1;
  s.pages.push({
    id: p.id || '',
    title: p.title,
    url: p.url,
    docType: dt,
    recency: rc,
    lastModified: p.lastModified,
    createdAt: p.createdAt || '',
    creator: p.creator || '',
    lastEditor: p.lastEditor || '',
    parentId: p.parentId || '',
    parentTitle: p.parentTitle || '',
    ancestorIds: p.ancestorIds || [],
    depth: p.depth ?? 0,
    childCount: 0,
  });
}

for (const s of spaces.values()) {
  const childCounts = new Map();
  for (const page of s.pages) {
    if (page.parentId) {
      childCounts.set(page.parentId, (childCounts.get(page.parentId) || 0) + 1);
    }
  }
  for (const page of s.pages) {
    page.childCount = childCounts.get(page.id) || 0;
  }
}

const contributorStats = buildContributorStats(pages);
const config = loadDepartmentConfig();
const contributorOverrides = config.contributorOverrides || {};

// Pass 1: manual → zoho → name/category heuristics
for (const s of spaces.values()) {
  const resolved = resolveSpaceDepartment(s.key, s.name, s.category, {
    pages: s.pages,
    employeeIndex,
  });
  s.department = resolved.departmentId;
  s.departmentSource = resolved.source;
  if (resolved.zoho) {
    s.zohoConfidence = resolved.zoho.confidence;
    s.zohoContributors = resolved.zoho.topContributors;
  }
}

// Pass 2: contributor network for spaces still unassigned
const spaceDeptMap = new Map([...spaces.values()].map((s) => [s.key || s.name, s.department]));

for (const s of spaces.values()) {
  if (s.department !== 'needs-owner') continue;
  const network = inferDepartmentFromContributorNetwork(
    s.key || s.name,
    s.pages,
    contributorStats,
    spaceDeptMap,
  );
  if (network?.departmentId) {
    s.department = network.departmentId;
    s.departmentSource = 'contributor-network';
    s.networkConfidence = network.confidence;
    s.networkContributors = network.topEditors;
    spaceDeptMap.set(s.key || s.name, s.department);
  }
}

// Re-infer contributor departments now that more spaces are assigned
const finalSpaceDeptMap = new Map([...spaces.values()].map((s) => [s.key || s.name, s.department]));
const contributors = buildContributorsCatalog(
  contributorStats,
  finalSpaceDeptMap,
  contributorOverrides,
);

const site = process.env.ATLASSIAN_SITE || 'lotusflare.atlassian.net';
const deptDefs = getDepartmentDefinitions();

const now = new Date().toISOString();
const refreshedAt =
  dataSource === 'live' && fetchedAt ? fetchedAt : previousRefreshedAt || fetchedAt || now;

const exportSpaces = [...spaces.values()]
  .sort((a, b) => b.pageCount - a.pageCount)
  .map((s) => ({
    id: s.key || s.name,
    name: s.name,
    key: s.key,
    category: s.category,
    department: s.department,
    departmentSource: s.departmentSource,
    networkConfidence: s.networkConfidence,
    networkContributors: s.networkContributors,
    zohoConfidence: s.zohoConfidence,
    zohoContributors: s.zohoContributors,
    pageCount: s.pageCount,
    docTypes: s.docTypes,
    recency: s.recency,
    confluenceUrl: `https://${site}/wiki/spaces/${s.key || s.name}`,
    pages: s.pages.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || '')),
  }));

const departments = {};
for (const deptId of DEPARTMENT_ORDER) {
  const def = deptDefs[deptId];
  if (!def) continue;
  const deptSpaces = exportSpaces.filter((s) => s.department === deptId);
  const pageCount = deptSpaces.reduce((n, sp) => n + sp.pageCount, 0);
  let lastActivity = '';
  for (const sp of deptSpaces) {
    for (const pg of sp.pages) {
      if (pg.lastModified && pg.lastModified > lastActivity) lastActivity = pg.lastModified;
    }
  }
  departments[deptId] = {
    label: def.label,
    description: def.description,
    color: def.color,
    owner: def.owner || { name: '', email: '' },
    spaceCount: deptSpaces.length,
    pageCount,
    lastActivity,
  };
}

const exportData = {
  meta: {
    totalPages: pages.length,
    totalSpaces: spaces.size,
    generatedAt: now,
    refreshedAt,
    dataSource,
    source: site,
    refreshMode: dataSource === 'live' ? 'scheduled' : 'cached',
    zohoEmployees: zohoEmployeeCount,
    contributorCount: contributorStats.size,
    departmentAssignment: 'space-level',
  },
  contributors,
  departments,
  categories: { ...CATEGORIES },
  spaces: exportSpaces,
};

for (const cid of Object.keys(CATEGORIES)) {
  const catSpaces = exportData.spaces.filter((s) => s.category === cid);
  exportData.categories[cid].pageCount = catSpaces.reduce((n, sp) => n + sp.pageCount, 0);
  exportData.categories[cid].spaceCount = catSpaces.length;
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(exportData));
console.log(`Wrote ${outputPath} — ${exportData.spaces.length} spaces, ${pages.length} pages`);
const needsOwner = departments['needs-owner']?.spaceCount || 0;
if (needsOwner > 0) {
  console.log(`  ⚠ ${needsOwner} space(s) in Needs Owner — edit scripts/config/departments.json`);
}

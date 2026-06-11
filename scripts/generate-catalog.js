/**
 * Build public/data/catalog.json from raw pages export.
 * Usage: node scripts/generate-catalog.js [path-to-raw-pages.json]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CATEGORIES, spaceCategory, docType, recency } from './lib/classify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultInput = join(__dirname, '../data/raw-pages.json');
const inputPath = process.argv[2] || defaultInput;
const outputPath = join(__dirname, '../public/data/catalog.json');

if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  console.error('Run: npm run fetch   (or npm run refresh)');
  process.exit(1);
}

const pages = JSON.parse(readFileSync(inputPath, 'utf8'));
const spaces = new Map();

for (const p of pages) {
  const sn = p.spaceName || '';
  const sk = p.spaceKey || '';
  const sid = sk || sn;
  if (!spaces.has(sid)) {
    spaces.set(sid, {
      name: sn,
      key: sk,
      category: spaceCategory(sn, sk),
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
    title: p.title,
    url: p.url,
    docType: dt,
    recency: rc,
    lastModified: p.lastModified,
    createdAt: p.createdAt || '',
    creator: p.creator || '',
    lastEditor: p.lastEditor || '',
  });
}

const site = process.env.ATLASSIAN_SITE || 'lotusflare.atlassian.net';

const exportData = {
  meta: {
    totalPages: pages.length,
    totalSpaces: spaces.size,
    generatedAt: new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
    source: site,
    refreshMode: 'scheduled',
  },
  categories: { ...CATEGORIES },
  spaces: [...spaces.values()]
    .sort((a, b) => b.pageCount - a.pageCount)
    .map((s) => ({
      id: s.key || s.name,
      name: s.name,
      key: s.key,
      category: s.category,
      pageCount: s.pageCount,
      docTypes: s.docTypes,
      recency: s.recency,
      confluenceUrl: `https://${site}/wiki/spaces/${s.key || s.name}`,
      pages: s.pages.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || '')),
    })),
};

for (const cid of Object.keys(CATEGORIES)) {
  const catSpaces = exportData.spaces.filter((s) => s.category === cid);
  exportData.categories[cid].pageCount = catSpaces.reduce((n, sp) => n + sp.pageCount, 0);
  exportData.categories[cid].spaceCount = catSpaces.length;
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(exportData));
console.log(`Wrote ${outputPath} — ${exportData.spaces.length} spaces, ${pages.length} pages`);

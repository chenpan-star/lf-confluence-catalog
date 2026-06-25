#!/usr/bin/env node
/**
 * Extended smoke tests: search, context crumbs, GitHub Pages base path build.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FAILURES = [];

function fail(msg) {
  FAILURES.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

async function importModule(path) {
  return import(path);
}

async function testSearch() {
  console.log('\nSearch');
  const { buildSearchIndex, searchCatalog } = await importModule(
    `file://${join(ROOT, 'src/lib/search.js')}`,
  );
  const { normalizeForSearch } = await importModule(
    `file://${join(ROOT, 'src/lib/text.js')}`,
  );

  const catalog = JSON.parse(readFileSync(join(ROOT, 'public/data/catalog.json'), 'utf8'));
  const index = buildSearchIndex(catalog);
  if (!index.length) fail('search index empty');
  else pass(`search index: ${index.length} items`);

  const enResults = searchCatalog(index, 'engineering');
  if (!enResults.spaces.length && !enResults.pages.length) {
    fail('search "engineering" returned no results');
  } else {
    pass(`search "engineering": ${enResults.totalMatches} matches`);
  }

  const spaceResults = searchCatalog(index, 'EN');
  const hasEnSpace = spaceResults.spaces.some((s) => s.title?.includes('Engineering') || s.subtitle?.includes('EN'));
  if (!hasEnSpace && !spaceResults.pages.length) fail('search "EN" found nothing');
  else pass('search by space key works');

  void normalizeForSearch;
}

function buildContextCrumbs(pathname, catalog, resolveSpace) {
  const crumbs = [{ label: 'Home', to: '/' }];
  const parsed = (() => {
    const catMatch = pathname.match(/\/category\/([^/]+)\/space\/([^/]+)\/pages\/(\d+)/);
    if (catMatch) return { categoryId: catMatch[1], spaceKey: decodeURIComponent(catMatch[2]), pageId: catMatch[3] };
    return null;
  })();

  if (pathname.startsWith('/category/')) {
    const catMatch = pathname.match(/^\/category\/([^/]+)/);
    const categoryId = catMatch?.[1];
    const category = categoryId ? catalog.categories?.[categoryId] : null;
    if (category) crumbs.push({ label: category.label, to: `/category/${categoryId}` });
    const spaceMatch = pathname.match(/^\/category\/[^/]+\/space\/([^/]+)/);
    if (spaceMatch && categoryId) {
      const spaceKey = decodeURIComponent(spaceMatch[1]);
      const space = resolveSpace(spaceKey);
      const pageMatch = pathname.match(/\/pages\/(\d+)/);
      if (pageMatch) {
        crumbs.push({ label: space?.name || spaceKey, to: `/category/${categoryId}/space/${spaceKey}` });
        crumbs.push({ label: `Page ${pageMatch[1]}` });
      } else {
        crumbs.push({ label: space?.name || spaceKey });
      }
    }
  }
  void parsed;
  return crumbs;
}

function testContextBar() {
  console.log('\nContext bar crumbs');
  const catalog = JSON.parse(readFileSync(join(ROOT, 'public/data/catalog.json'), 'utf8'));
  const resolveSpace = (key) => catalog.spaces.find((s) => s.key === key || s.key === decodeURIComponent(key));

  const spaceOnly = buildContextCrumbs('/category/engineering/space/EN', catalog, resolveSpace);
  if (spaceOnly.length !== 3 || spaceOnly[2].label !== resolveSpace('EN')?.name) {
    fail(`space-only crumbs wrong: ${JSON.stringify(spaceOnly.map((c) => c.label))}`);
  } else pass('space view shows 3 crumbs');

  const pageView = buildContextCrumbs(
    '/category/engineering/space/EN/pages/7485620374',
    catalog,
    resolveSpace,
  );
  if (pageView.length !== 4) fail(`page crumbs expected 4, got ${pageView.length}`);
  else pass('page view shows 4 crumbs');
}

function testGhPagesBuild() {
  console.log('\nGitHub Pages build');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    env: { ...process.env, VITE_BASE_PATH: '/lf-confluence-catalog/' },
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`build failed: ${result.stderr?.slice(0, 200)}`);
    return;
  }
  pass('build with VITE_BASE_PATH succeeds');

  const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  if (!html.includes('/lf-confluence-catalog/assets/')) {
    fail('index.html missing base path assets');
  } else pass('asset paths use base path');

  if (!readFileSync(join(ROOT, 'dist/404.html'), 'utf8').includes('/lf-confluence-catalog/')) {
    fail('404.html missing base path');
  } else pass('404.html SPA fallback present');
}

async function main() {
  console.log('Extended E2E tests');
  await testSearch();
  testContextBar();
  testGhPagesBuild();

  console.log('');
  if (FAILURES.length) {
    console.error(`FAILED: ${FAILURES.length} issue(s)`);
    process.exit(1);
  }
  console.log('All extended tests passed.');
}

main();

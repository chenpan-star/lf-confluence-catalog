#!/usr/bin/env node
/**
 * Smoke tests: catalog integrity, route helpers, and static preview HTTP checks.
 * Run: npm run build && npm run preview &  node scripts/e2e-smoke.js
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const FAILURES = [];

function fail(msg) {
  FAILURES.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── Catalog integrity ─────────────────────────────────────────────
function testCatalog() {
  console.log('\nCatalog integrity');
  const raw = readFileSync(join(ROOT, 'public/data/catalog.json'), 'utf8');
  const catalog = JSON.parse(raw);

  if (!catalog.meta?.totalSpaces) fail('meta.totalSpaces missing');
  else pass(`meta.totalSpaces = ${catalog.meta.totalSpaces}`);

  if (!catalog.categories || Object.keys(catalog.categories).length < 1) {
    fail('categories missing or empty');
  } else {
    pass(`${Object.keys(catalog.categories).length} categories`);
  }

  if (!Array.isArray(catalog.spaces) || catalog.spaces.length < 1) {
    fail('spaces missing or empty');
  } else {
    pass(`${catalog.spaces.length} spaces`);
  }

  const noOwner = catalog.spaces.filter((s) => !s.owner?.name?.trim());
  if (noOwner.length) fail(`${noOwner.length} spaces missing owner.name`);
  else pass('all spaces have owner');

  const sample = catalog.spaces.find((s) => s.pages?.length > 5 && s.category);
  if (!sample) {
    fail('no suitable sample space for route tests');
    return null;
  }
  pass(`sample space: ${sample.key} (${sample.category})`);
  return { catalog, sample };
}

// ── Route path helpers (mirror src/lib/spacePaths.js) ───────────────
function parsePageRouteContext(pathname) {
  const catMatch = pathname.match(/\/category\/([^/]+)\/space\/([^/]+)\/pages\/(\d+)/);
  if (catMatch) {
    return {
      categoryId: catMatch[1],
      spaceKey: decodeURIComponent(catMatch[2]),
      pageId: catMatch[3],
    };
  }
  const deptMatch = pathname.match(/\/department\/([^/]+)\/space\/([^/]+)\/pages\/(\d+)/);
  if (deptMatch) {
    return {
      departmentId: deptMatch[1],
      spaceKey: decodeURIComponent(deptMatch[2]),
      pageId: deptMatch[3],
    };
  }
  const match = pathname.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (!match) return null;
  return { spaceKey: decodeURIComponent(match[1]), pageId: match[2] };
}

function pageCatalogPath(page, spaceKey, context) {
  const ctx = typeof context === 'string' ? { departmentId: context } : context || {};
  const key = spaceKey || page?.spaceKey;
  if (page?.id && key) {
    if (ctx.categoryId) {
      return `/category/${ctx.categoryId}/space/${encodeURIComponent(key)}/pages/${page.id}`;
    }
    if (ctx.departmentId) {
      return `/department/${ctx.departmentId}/space/${encodeURIComponent(key)}/pages/${page.id}`;
    }
    return `/spaces/${encodeURIComponent(key)}/pages/${page.id}`;
  }
  return null;
}

function testRoutes(sample) {
  console.log('\nRoute helpers');
  const { catalog, sample: space } = sample;
  const page = space.pages[0];
  const catId = space.category;
  const deptId = space.department;

  const catPath = pageCatalogPath(page, space.key, { categoryId: catId });
  if (!catPath?.includes(`/category/${catId}/`)) fail(`category page path invalid: ${catPath}`);
  else pass(`category page path: ${catPath}`);

  const deptPath = pageCatalogPath(page, space.key, { departmentId: deptId });
  if (!deptPath?.includes(`/department/${deptId}/`)) fail(`department page path invalid: ${deptPath}`);
  else pass(`department page path: ${deptPath}`);

  const parsed = parsePageRouteContext(catPath);
  if (!parsed || parsed.spaceKey !== space.key || parsed.categoryId !== catId) {
    fail(`parsePageRouteContext failed for ${catPath}`);
  } else pass('parsePageRouteContext round-trip');

  const encodedKey = encodeURIComponent(space.key);
  const routes = [
    '/',
    '/categories',
    `/category/${catId}`,
    `/category/${catId}/space/${encodedKey}`,
    catPath,
    '/spaces',
    `/space/${encodedKey}`,
    '/search',
    '/departments',
    `/department/${deptId}`,
    `/department/${deptId}/space/${encodedKey}`,
    deptPath,
    '/stale',
    '/review/editors',
    '/review/my-pages',
    '/contributors',
  ];

  const unknown = routes.filter((r) => parsePageRouteContext(r) === null && r.includes('/pages/'));
  if (unknown.length) fail(`unparsed page routes: ${unknown.join(', ')}`);
  else pass(`${routes.length} route patterns validated`);

  return routes;
}

// ── HTTP preview checks ─────────────────────────────────────────────
async function testHttp(routes) {
  console.log('\nHTTP preview');
  const assets = ['/', '/data/catalog.json', '/config/slack.json', '/config/space-owners.json'];

  for (const path of [...assets, ...routes.slice(0, 6)]) {
    try {
      const res = await fetch(`${BASE}${path}`, { redirect: 'follow' });
      if (!res.ok) {
        fail(`${path} → HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (path.endsWith('.json') && !ct.includes('json')) {
        fail(`${path} wrong content-type: ${ct}`);
      } else if (path === '/' && !ct.includes('html')) {
        fail(`/ wrong content-type: ${ct}`);
      } else {
        pass(`${path} → ${res.status}`);
      }
    } catch (e) {
      fail(`${path} → ${e.message}`);
    }
  }
}

async function main() {
  console.log('E2E smoke tests');
  console.log(`Preview base: ${BASE}`);

  const sample = testCatalog();
  if (sample) {
    const routes = testRoutes(sample);
    await testHttp(routes);
  }

  console.log('');
  if (FAILURES.length) {
    console.error(`FAILED: ${FAILURES.length} issue(s)`);
    process.exit(1);
  }
  console.log('All smoke tests passed.');
}

main();

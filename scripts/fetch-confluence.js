/**
 * Fetch all non-personal Confluence pages via REST API.
 * Requires: ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 * Optional: ATLASSIAN_SITE (default lotusflare.atlassian.net)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './load-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../data/raw-pages.json');

const CQL = 'type = page AND space.type != personal';
const EXPAND = 'content,content.history,content.version,content.ancestors';
const LIMIT = 250;
const DELAY_MS = 200;

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function authHeader() {
  const email = env('ATLASSIAN_EMAIL');
  const token = env('ATLASSIAN_API_TOKEN');
  if (!email || !token) {
    throw new Error(
      'Missing ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN. Copy .env.example → .env and fill in values.',
    );
  }
  const encoded = Buffer.from(`${email}:${token}`).toString('base64');
  return `Basic ${encoded}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSpaceKey(result) {
  const container = result.resultGlobalContainer || {};
  const displayUrl = container.displayUrl || '';
  const match = displayUrl.match(/\/spaces\/([^/]+)/);
  if (match) return match[1];
  const contentSpace = result.content?.space;
  if (contentSpace?.key) return contentSpace.key;
  const url = result.url || '';
  const urlMatch = url.match(/\/spaces\/([^/]+)/);
  return urlMatch ? urlMatch[1] : '';
}

function toFullUrl(pathOrUrl) {
  const site = env('ATLASSIAN_SITE', 'lotusflare.atlassian.net');
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const path = pathOrUrl.startsWith('/wiki') ? pathOrUrl : `/wiki${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  return `https://${site.replace(/^https?:\/\//, '')}${path}`;
}

/** Use the newest timestamp; prefer content.version.when over search index lastModified. */
function pickLastModified(searchLastModified, versionWhen) {
  const candidates = [versionWhen, searchLastModified].filter(Boolean);
  if (!candidates.length) return '';
  let newest = candidates[0];
  for (const value of candidates.slice(1)) {
    if (new Date(value).getTime() > new Date(newest).getTime()) newest = value;
  }
  return newest;
}

function normalizeResult(result) {
  const content = result.content || {};
  const history = content.history || {};
  const version = content.version || {};
  const spaceName = result.resultGlobalContainer?.title || content.space?.name || '';
  const spaceKey = parseSpaceKey(result);

  const ancestors = content.ancestors || [];
  const parent = ancestors.length ? ancestors[ancestors.length - 1] : null;

  return {
    id: content.id ? String(content.id) : '',
    title: result.title || content.title || '',
    url: toFullUrl(result.url || ''),
    excerpt: result.excerpt || '',
    lastModified: pickLastModified(result.lastModified, version.when),
    createdAt: history.createdDate || '',
    spaceName,
    spaceKey,
    creator: history.createdBy?.displayName || history.createdBy?.publicName || '',
    lastEditor: version.by?.displayName || version.by?.publicName || '',
    parentId: parent ? String(parent.id) : '',
    parentTitle: parent?.title || '',
    ancestorIds: ancestors.map((a) => String(a.id)),
    depth: ancestors.length,
  };
}

function extractCursor(nextLink) {
  if (!nextLink) return null;
  try {
    const url = new URL(nextLink, 'https://example.com');
    return url.searchParams.get('cursor');
  } catch {
    const match = String(nextLink).match(/cursor=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

async function fetchPage(cql, cursor) {
  const site = env('ATLASSIAN_SITE', 'lotusflare.atlassian.net');
  const params = new URLSearchParams({ cql, limit: String(LIMIT), expand: EXPAND });
  if (cursor) params.set('cursor', cursor);

  const url = `https://${site}/wiki/rest/api/search?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let hint = '';
    if (res.status === 403 && body.includes('not permitted to use Confluence')) {
      hint =
        '\n\nYour API token account lacks a Confluence license seat. ' +
        'Run: npm run test:auth   for diagnosis. ' +
        'Or: npm run refresh -- --offline   to use cached data.';
    } else if (res.status === 401) {
      hint = '\n\nInvalid email or API token. Regenerate at id.atlassian.com/manage-profile/security/api-tokens';
    }
    throw new Error(`Confluence API ${res.status}: ${body.slice(0, 300)}${hint}`);
  }

  return res.json();
}

export async function fetchAllPages({ onProgress } = {}) {
  const all = [];
  let cursor = null;
  let batch = 0;

  do {
    batch += 1;
    const data = await fetchPage(CQL, cursor);
    const results = data.results || [];
    for (const r of results) {
      all.push(normalizeResult(r));
    }

    if (onProgress) {
      onProgress({
        batch,
        fetched: all.length,
        totalSize: data.totalSize ?? null,
      });
    }

    cursor = extractCursor(data._links?.next);
    if (cursor) await sleep(DELAY_MS);
  } while (cursor);

  return all;
}

async function main() {
  console.log('Fetching Confluence pages…');
  const pages = await fetchAllPages({
    onProgress: ({ batch, fetched, totalSize }) => {
      const total = totalSize ? ` / ~${totalSize}` : '';
      process.stdout.write(`\r  Batch ${batch}: ${fetched}${total} pages`);
    },
  });
  console.log(`\nFetched ${pages.length} pages.`);

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(pages, null, 0));
  console.log(`Wrote ${OUTPUT}`);
  return pages.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv();
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

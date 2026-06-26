/**
 * Full refresh: fetch from Confluence → generate catalog.json
 * Usage: npm run refresh
 */
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { loadEnv } from './load-env.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const rawPath = join(root, 'data/raw-pages.json');
const legacyPath = '/tmp/all_confluence_pages.json';
const offlineMode = process.argv.includes('--offline');

function hasCredentials() {
  return Boolean(process.env.ATLASSIAN_EMAIL?.trim() && process.env.ATLASSIAN_API_TOKEN?.trim());
}

function useCachedRaw(label) {
  console.warn(`  ⚠ ${label}\n`);
  if (!existsSync(rawPath) && existsSync(legacyPath)) {
    mkdirSync(dirname(rawPath), { recursive: true });
    copyFileSync(legacyPath, rawPath);
  }
  if (!existsSync(rawPath)) {
    console.error('No cached data/raw-pages.json available.');
    process.exit(1);
  }
}

function hasZohoCredentials() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID?.trim() &&
      process.env.ZOHO_CLIENT_SECRET?.trim() &&
      process.env.ZOHO_REFRESH_TOKEN?.trim(),
  );
}

async function fetchZohoEmployees() {
  try {
    const { fetchAndSaveEmployees } = await import('./fetch-zoho-people.js');
    const payload = await fetchAndSaveEmployees({
      onProgress: ({ batch, fetched }) => {
        process.stdout.write(`\r  Zoho batch ${batch}: ${fetched} employees`);
      },
    });
    console.log(`\n  ✓ Fetched ${payload.count} employees from Zoho People\n`);
    return true;
  } catch (err) {
    console.warn(`\n  ⚠ Zoho fetch skipped: ${err.message}\n`);
    return false;
  }
}

async function main() {
  console.log('=== Confluence catalog refresh ===\n');

  let dataSource = 'live';
  let fetchedAt = '';

  if (offlineMode) {
    useCachedRaw('Offline mode — using cached data/raw-pages.json');
    dataSource = 'offline';
  } else if (hasCredentials()) {
    try {
      const { fetchAllPages } = await import('./fetch-confluence.js');
      const pages = await fetchAllPages({
        onProgress: ({ batch, fetched, totalSize }) => {
          const total = totalSize ? ` / ~${totalSize}` : '';
          process.stdout.write(`\r  Fetching batch ${batch}: ${fetched}${total} pages`);
        },
      });
      fetchedAt = new Date().toISOString();
      console.log(`\n  ✓ Fetched ${pages.length} pages from Confluence\n`);
      const { writeFileSync } = await import('fs');
      mkdirSync(dirname(rawPath), { recursive: true });
      writeFileSync(rawPath, JSON.stringify(pages));
    } catch (err) {
      const email = process.env.ATLASSIAN_EMAIL?.trim() || '(not set)';
      console.error(`\n  ✗ Fetch failed: ${err.message}`);
      console.error(`  Account used: ${email}\n`);
      if (String(err.message).includes('403') || String(err.message).includes('not permitted')) {
        console.error(
          '  → This email needs a Confluence license seat. Run: npm run test:auth\n' +
            '  → For GitHub Actions: update repository secrets ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN\n' +
            '    (create token at id.atlassian.com while logged in as that licensed user).\n',
        );
      }
      if (existsSync(rawPath)) {
        useCachedRaw('Falling back to existing data/raw-pages.json');
        dataSource = 'cache';
      } else {
        console.error('No cache to fall back to. Fix auth (npm run test:auth) or use --offline after first successful fetch.');
        process.exit(1);
      }
    }
  } else if (existsSync(rawPath)) {
    console.warn('  ⚠ No API credentials — reusing existing data/raw-pages.json\n');
    dataSource = 'cache';
  } else if (existsSync(legacyPath)) {
    console.warn('  ⚠ No API credentials — copying /tmp/all_confluence_pages.json\n');
    mkdirSync(dirname(rawPath), { recursive: true });
    copyFileSync(legacyPath, rawPath);
    dataSource = 'cache';
  } else {
    console.error(
      'No credentials and no local export found.\n' +
        'Set ATLASSIAN_EMAIL + ATLASSIAN_API_TOKEN in .env, or place data/raw-pages.json',
    );
    process.exit(1);
  }

  if (!offlineMode && hasZohoCredentials()) {
    await fetchZohoEmployees();
  }

  const gen = spawnSync('node', ['scripts/generate-catalog.js'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CATALOG_DATA_SOURCE: dataSource,
      CATALOG_FETCHED_AT: fetchedAt,
    },
  });

  if (gen.status !== 0) process.exit(gen.status ?? 1);
  console.log('\n=== Refresh complete ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

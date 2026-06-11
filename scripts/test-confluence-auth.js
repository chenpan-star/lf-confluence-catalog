/**
 * Diagnose Confluence API credentials.
 * Usage: npm run test:auth
 */
import { loadEnv } from './load-env.js';

loadEnv();

const email = process.env.ATLASSIAN_EMAIL?.trim();
const token = process.env.ATLASSIAN_API_TOKEN?.trim();
const site = process.env.ATLASSIAN_SITE?.trim() || 'lotusflare.atlassian.net';

if (!email || !token) {
  console.error('❌ Missing ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

async function check(label, url) {
  const res = await fetch(url, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { label, status: res.status, ok: res.ok, json, text: text.slice(0, 400) };
}

console.log('Testing Confluence API credentials…\n');
console.log(`  Email: ${email}`);
console.log(`  Site:  ${site}\n`);

const checks = await Promise.all([
  check('Current user', `https://${site}/wiki/rest/api/user/current`),
  check('Search (1 page)', `https://${site}/wiki/rest/api/search?cql=type=page&limit=1`),
]);

for (const c of checks) {
  const icon = c.ok ? '✓' : '✗';
  console.log(`${icon} ${c.label}: HTTP ${c.status}`);
  if (c.json?.displayName) console.log(`    User: ${c.json.displayName}`);
  if (c.json?.message) console.log(`    Message: ${c.json.message}`);
  if (!c.ok && !c.json?.message) console.log(`    ${c.text}`);
}

const failed = checks.find((c) => !c.ok);
if (failed) {
  console.log(`
────────────────────────────────────────────────────────────
403 "Current user not permitted to use Confluence" means:

  The email + API token work for Atlassian login, but that
  account does NOT have Confluence API access (no license seat).

Fix:
  1. Confirm ATLASSIAN_EMAIL is the exact email you use in Confluence
     (check: open Confluence → profile → should match .env)

  2. Create a NEW token at https://id.atlassian.com/manage-profile/security/api-tokens
     while logged into THAT same account

  3. If email is correct but still 403 → ask your IT/Confluence admin
     to assign you a Confluence license (API needs a licensed seat)

  4. Do NOT use a Jira-only token or another person's token

Until fixed, run:  npm run refresh -- --offline
  (reuses the existing local snapshot)
────────────────────────────────────────────────────────────`);
  process.exit(1);
}

console.log('\n✓ Credentials OK — npm run refresh should work.');

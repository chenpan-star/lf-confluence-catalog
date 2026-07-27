#!/usr/bin/env node
/**
 * Test Jira assign+notify on an existing issue (no catalog UI).
 * Usage: node scripts/test-jira-notify.mjs PROT-123 [accountId-or-email]
 */
import { loadEnv } from './load-env.js';

loadEnv();

const issueKey = process.argv[2]?.trim();
const who = process.argv[3]?.trim();
const base = (process.env.JIRA_BASE_URL || process.env.ATLASSIAN_SITE || 'https://lotusflare.atlassian.net')
  .replace(/\/$/, '')
  .replace(/\/wiki.*$/, '');
const email = process.env.ATLASSIAN_EMAIL?.trim();
const token = process.env.ATLASSIAN_API_TOKEN?.trim();

if (!issueKey || !email || !token) {
  console.error('Usage: node scripts/test-jira-notify.mjs PROT-123 [email-or-accountId]');
  console.error('Needs ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');

async function jira(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function resolveAccountId(query) {
  if (query.startsWith('712020:') || /^[a-f0-9]{24}$/i.test(query)) return query;
  const users = await jira(
    `/rest/api/3/user/search?${new URLSearchParams({ query, maxResults: '3' })}`,
  );
  if (!users?.[0]?.accountId) throw new Error(`No Jira user for ${query}`);
  return users[0].accountId;
}

const accountId = who ? await resolveAccountId(who) : null;
if (!accountId) {
  console.error('Provide email or accountId as second argument');
  process.exit(1);
}

console.log('Issue', issueKey, '→ account', accountId);

try {
  await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee?notifyUsers=true`, {
    method: 'PUT',
    body: JSON.stringify({ accountId }),
  });
  console.log('OK: assignee set with notifyUsers=true');
} catch (e) {
  console.error('FAIL assign:', e.message);
}

try {
  await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/watchers`, {
    method: 'POST',
    body: JSON.stringify(accountId),
  });
  console.log('OK: watcher added');
} catch (e) {
  console.error('FAIL watcher:', e.message);
}

try {
  await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/notify`, {
    method: 'POST',
    body: JSON.stringify({
      subject: `[catalog test] notify ${issueKey}`,
      textBody: `Test notify for ${issueKey}`,
      htmlBody: `<p>Test notify for ${issueKey}</p>`,
      to: { assignee: true, watchers: true, users: [{ accountId }] },
    }),
  });
  console.log('OK: /notify queued');
} catch (e) {
  console.error('FAIL notify:', e.message);
}

console.log('\nCheck inbox + issue comments. If all OK but no mail, Jira notification scheme blocks outbound email.');

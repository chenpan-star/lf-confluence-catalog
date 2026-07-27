#!/usr/bin/env node
/**
 * End-to-end check: catalog Jira email paths on PROT (read-only except optional notify POST).
 * Usage: node scripts/verify-jira-prot-email.mjs [ISSUE_KEY] [assignee-email]
 * Example: node scripts/verify-jira-prot-email.mjs PROT-47 chen.pan@lotusflare.com
 */
import { loadEnv } from './load-env.js';

loadEnv();

function jiraBaseUrl(raw) {
  let s = String(raw || 'lotusflare.atlassian.net')
    .trim()
    .replace(/\/$/, '')
    .replace(/\/wiki.*$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^https?:\/\//, '')}`;
  return s;
}

const issueKey = (process.argv[2] || 'PROT-47').trim();
const assigneeQuery = process.argv[3]?.trim();
const base = jiraBaseUrl(process.env.JIRA_BASE_URL || process.env.ATLASSIAN_SITE);
const email = process.env.ATLASSIAN_EMAIL?.trim();
const token = process.env.ATLASSIAN_API_TOKEN?.trim();

if (!email || !token) {
  console.error('Needs ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');
const headers = {
  Accept: 'application/json',
  Authorization: `Basic ${auth}`,
  'Content-Type': 'application/json',
};

async function jira(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function pass(msg) {
  console.log('  ✓', msg);
}
function fail(msg) {
  console.log('  ✗', msg);
}
function warn(msg) {
  console.log('  !', msg);
}

console.log('LF catalog — Jira email verification');
console.log('Site:', base);
console.log('Issue:', issueKey);
console.log('');

const me = await jira('/rest/api/3/myself');
if (!me.ok) {
  fail(`API auth failed (${me.status})`);
  process.exit(1);
}
pass(`API token user: ${me.data.displayName} <${me.data.emailAddress}>`);

const issue = await jira(
  `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=assignee,reporter,labels,project`,
);
if (!issue.ok) {
  fail(`Cannot load ${issueKey} (${issue.status})`);
  process.exit(1);
}

const f = issue.data.fields;
const proj = f.project;
pass(`Project ${proj.key} (${proj.name}) type=${proj.projectTypeKey}`);

const assigneeId = f.assignee?.accountId;
const reporterId = f.reporter?.accountId;
if (assigneeQuery) {
  const search = await jira(
    `/rest/api/3/user/search?${new URLSearchParams({ query: assigneeQuery, maxResults: '1' })}`,
  );
  const expected = search.data?.[0]?.accountId;
  if (expected && assigneeId !== expected) {
    warn(`Assignee on issue is not ${assigneeQuery} (check issue key)`);
  }
}

if (me.data.accountId === assigneeId && me.data.accountId === reporterId) {
  warn('Assignee = reporter = API token user → Jira often suppresses email (self-action).');
  warn('Retest with a bot API user + another person triggering remind, or Automation.');
} else if (me.data.accountId === assigneeId) {
  warn('You are assignee but not reporter — mail may work if scheme + Automation allow.');
} else if (me.data.accountId === reporterId) {
  pass('Assignee is different from API user (good for owner email tests).');
}

const schemeLink = await jira(`/rest/api/3/project/${encodeURIComponent(proj.key)}/notificationscheme`);
if (schemeLink.ok) {
  pass(`Notification scheme: ${schemeLink.data.name} (id ${schemeLink.data.id})`);
} else {
  warn(`Could not read notification scheme (${schemeLink.status})`);
}

const notify = await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/notify`, {
  method: 'POST',
  body: JSON.stringify({
    subject: `[catalog verify] ${issueKey}`,
    textBody: 'verify',
    htmlBody: '<p>verify</p>',
    to: {
      reporter: true,
      assignee: true,
      watchers: true,
      users: assigneeId ? [{ accountId: assigneeId }] : [],
    },
  }),
});

if (notify.ok) {
  pass('POST /notify accepted (204) — still check inbox; PROT often rejects this.');
} else {
  fail(`POST /notify → ${notify.status}: ${notify.data?.errorMessages?.join(' ') || JSON.stringify(notify.data)}`);
  warn('Catalog Worker cannot send custom API email on this project. Fix: Jira Automation or Slack DM.');
}

console.log('\n--- Fix checklist (in order) ---');
console.log('1. Jira admin: PROT Automation — Issue assigned + label confluence-catalog → Send email to assignee.');
console.log('2. Maintainer: Worker ATLASSIAN_* = dedicated bot user (not the page owner). Redeploy Worker.');
console.log('3. Owner: personal notification email ON for mentions + assignments (you did this).');
console.log('4. UI: Send Slack DM for reliable non-Jira ping.');
console.log('5. Manual: ⋯ Send email to users on a PROT issue — if that fails, site mail is broken (IT/admin).');
console.log('\nDocs: DEPLOY.md § Owner inbox email');

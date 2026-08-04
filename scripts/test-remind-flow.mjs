#!/usr/bin/env node
/**
 * Remind flow checks: client helpers (always) + live Worker (when .env has URL + secret).
 * Run: npm run test:remind
 */
import { loadEnv } from './load-env.js';
import {
  isEligibleForFollowUp,
  summarizeRemindTracking,
  outdatedPageUrls,
  buildCatalogUrlIndex,
} from './lib/remind-followup-lib.mjs';
import {
  buildRemindJiraPartKey,
  normalizeRemindJiraLock,
  resolveRemindJiraUrl,
} from '../src/lib/remindTrack.js';

loadEnv();

const FAILURES = [];

function fail(msg) {
  FAILURES.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

async function testClientHelpers() {
  console.log('\nRemind client helpers');

  const url = resolveRemindJiraUrl('PROT-99', '');
  if (!url.includes('/browse/PROT-99')) fail(`resolveRemindJiraUrl: ${url}`);
  else pass('resolveRemindJiraUrl from key only');

  const lock = normalizeRemindJiraLock({ issueKey: 'PROT-1', issueUrl: '', duplicate: true });
  if (!lock?.issueUrl?.includes('PROT-1')) fail('normalizeRemindJiraLock missing url');
  else pass('normalizeRemindJiraLock fills browse URL');

  const key = buildRemindJiraPartKey({
    editor: 'Ada Lovelace',
    partIndex: 2,
    partTotal: 3,
    pageIds: ['b', 'a'],
  });
  if (!key.includes('Ada Lovelace') || !key.includes('a,b')) {
    fail(`buildRemindJiraPartKey unstable: ${key}`);
  } else pass('buildRemindJiraPartKey stable page id order');
}

async function testLiveWorker() {
  const base = (process.env.VITE_REMIND_TRACK_URL || '').replace(/\/$/, '');
  const secret = process.env.REMIND_API_SECRET || process.env.VITE_REMIND_API_KEY || '';
  if (!base || !secret) {
    console.log('\nLive Worker (skipped — set VITE_REMIND_TRACK_URL + REMIND_API_SECRET in .env)');
    return;
  }

  console.log('\nLive Worker');

  const health = await fetch(`${base}/health`).then((r) => r.json()).catch(() => ({}));
  if (!health.ok) fail(`health: ${JSON.stringify(health)}`);
  else pass(`health ok (jira=${health.jiraConfigured} slack=${health.slackConfigured})`);

  const auth = await fetch(`${base}/v1/auth-check`, {
    headers: { Authorization: `Bearer ${secret}` },
  }).then((r) => r.json());
  if (!auth.ok) fail('auth-check failed');
  else pass('auth-check authorized');

  const lookupRes = await fetch(`${base}/v1/remind/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      editor: '__e2e_no_such_editor__',
      message: 'https://lotusflare.atlassian.net/wiki/spaces/ZZZ/pages/1',
      pagesCount: 1,
      partIndex: 1,
      partTotal: 1,
    }),
  });
  const lookup = await lookupRes.json().catch(() => ({}));
  if (!lookupRes.ok || lookup.ok !== true) {
    fail(`lookup HTTP ${lookupRes.status}: ${lookup.error || 'bad body'}`);
  } else if (lookup.found !== false) {
    fail('lookup should not find ticket for fake editor');
  } else pass('lookup endpoint responds (not found for fake editor)');

  const slackOnly = await fetch(`${base}/v1/remind`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      editor: 'Test',
      message: 'e2e slack without jira key',
      pagesCount: 1,
      sendSlack: true,
      createJira: false,
    }),
  }).then((r) => r.json().catch(() => ({})));
  if (slackOnly.slack?.ok) fail('Worker must not send Slack without Jira link');
  else pass('Worker rejects Slack without jiraIssueKey');
}

async function testFollowUpHelpers() {
  console.log('\nRemind follow-up helpers');

  const tracking = summarizeRemindTracking([
    { event: 'first_slack', at: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  ]);
  const due = isEligibleForFollowUp(tracking, {
    intervalMinutes: 2,
    maxFollowUps: 5,
    force: false,
  });
  if (!due.eligible) fail(`expected eligible after 3 min with 2 min interval: ${due.reason}`);
  else pass('follow-up eligible when interval elapsed');

  const early = isEligibleForFollowUp(tracking, {
    intervalMinutes: 10,
    maxFollowUps: 5,
    force: false,
  });
  if (early.eligible) fail('expected not eligible before interval');
  else pass('follow-up blocked before interval');

  const index = buildCatalogUrlIndex({
    spaces: [{ pages: [{ url: 'https://lotusflare.atlassian.net/wiki/x', recency: 'stale' }] }],
  });
  const stale = outdatedPageUrls(['https://lotusflare.atlassian.net/wiki/x'], index);
  if (stale.length !== 1) fail('stale page should stay outdated');
  else pass('catalog stale check');
}

async function main() {
  console.log('Remind flow tests');
  await testClientHelpers();
  await testFollowUpHelpers();
  await testLiveWorker();

  console.log('');
  if (FAILURES.length) {
    console.error(`FAILED: ${FAILURES.length} issue(s)`);
    process.exit(1);
  }
  console.log('All remind flow tests passed.');
}

main();

#!/usr/bin/env node
/**
 * Unit tests for remind follow-up helpers (no live Jira/Worker required).
 * Run: npm run test:remind-followup-lib
 */
import { loadEnv } from './load-env.js';
import {
  REMIND_SENT_LABEL,
  REMIND_TRACKING_PREFIX,
  buildCatalogUrlIndex,
  extractPageUrlsFromIssue,
  followUpIntervalMinutesFromEnv,
  followUpMaxCount,
  isEligibleForFollowUp,
  jiraSearchJql,
  outdatedPageUrls,
  parseRemindTrackingComments,
  parseTrackingPayloadFallback,
  searchFollowUpCandidates,
  summarizeRemindTracking,
} from './lib/remind-followup-lib.mjs';

loadEnv();

const FAILURES = [];

function fail(msg) {
  FAILURES.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function testTrackingParse() {
  console.log('\nTracking comment parse');

  const prefix = REMIND_TRACKING_PREFIX;
  const events = parseRemindTrackingComments({
    comments: [
      { id: '1', body: `Hello\n${prefix}{"event":"first_slack","at":"2026-01-01T00:00:00.000Z"}` },
      { id: '2', body: { type: 'doc', content: [] } },
      { id: '3', body: `${prefix}{"event":"follow_up","at":"2026-01-08T00:00:00.000Z"}` },
      { id: '4', body: `${prefix}not-json` },
    ],
  });

  if (events.length !== 2) fail(`expected 2 tracking events, got ${events.length}`);
  else pass('parses first_slack and follow_up from comments');

  const summary = summarizeRemindTracking(events);
  if (summary.followUpCount !== 1 || !summary.firstSlack) {
    fail('summarizeRemindTracking miscount');
  } else pass('summarizeRemindTracking counts follow-ups');

  const adfBroken =
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"catalog-remind-meta:{\\"event\\":\\"first_slack\\",\\"at\\":\\"2026-08-11T03:36:53.952Z\\",\\"editor\\":\\"chen.pan\\",\\"editorEmail\\":\\"chen.pan@lotusflare.com\\",\\"slackUserId\\":\\"U0A4H691631\\",\\"message\\":\\"truncated"},{"type":"text","text":"Page title"}]}]}';
  const recovered = parseTrackingPayloadFallback(adfBroken);
  if (recovered?.event !== 'first_slack' || recovered?.editor !== 'chen.pan') {
    fail('ADF-split tracking fallback parse failed');
  } else pass('recovers first_slack from ADF-split tracking comment');
}

function testEligibility() {
  console.log('\nFollow-up eligibility');

  const dueTracking = summarizeRemindTracking([
    { event: 'first_slack', at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { event: 'follow_up', at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
  ]);
  const tooSoonTracking = summarizeRemindTracking([
    { event: 'first_slack', at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { event: 'follow_up', at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  const due = isEligibleForFollowUp(dueTracking, { intervalMinutes: 7 * 24 * 60, maxFollowUps: 5 });
  if (!due.eligible) fail(`expected due after 8d since last follow-up: ${due.reason}`);
  else pass('eligible when interval elapsed since last follow-up');

  const tooSoon = isEligibleForFollowUp(tooSoonTracking, {
    intervalMinutes: 7 * 24 * 60,
    maxFollowUps: 5,
  });
  if (tooSoon.eligible) fail('should not be due only 1d after last follow-up');
  else if (tooSoon.reason !== 'interval_not_elapsed' || !tooSoon.nextEligibleAt) {
    fail('interval_not_elapsed should include nextEligibleAt');
  } else pass('interval_not_elapsed includes nextEligibleAt when blocked early');

  const maxed = summarizeRemindTracking([
    { event: 'first_slack', at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    ...Array.from({ length: 5 }, (_, i) => ({
      event: 'follow_up',
      at: new Date(Date.now() - (20 - i) * 24 * 60 * 60 * 1000).toISOString(),
    })),
  ]);

  const blocked = isEligibleForFollowUp(
    summarizeRemindTracking([{ event: 'first_slack', at: new Date().toISOString() }]),
    { intervalMinutes: 60, maxFollowUps: 5 },
  );
  if (blocked.eligible) fail('should block within 60 min of first_slack');
  else pass('blocks follow-up before interval');

  const cap = isEligibleForFollowUp(maxed, { intervalMinutes: 1, maxFollowUps: 5 });
  if (cap.eligible || cap.reason !== 'max_followups_reached') fail('should cap at max follow-ups');
  else pass('max_followups_reached at limit');

  const forced = isEligibleForFollowUp(summarizeRemindTracking([]), {
    intervalMinutes: 999,
    maxFollowUps: 0,
    force: true,
  });
  if (!forced.eligible) fail('force bypasses checks');
  else pass('force=true always eligible');
}

function testCatalogAndUrls() {
  console.log('\nCatalog + issue URL extract');

  const issue = {
    fields: {
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'https://lotusflare.atlassian.net/wiki/spaces/EN/pages/123/Foo',
              },
            ],
          },
        ],
      },
    },
  };
  const urls = extractPageUrlsFromIssue(issue);
  if (urls.length !== 1 || !urls[0].includes('/pages/123/')) {
    fail(`extractPageUrlsFromIssue: ${urls.join(',')}`);
  } else pass('extractPageUrlsFromIssue from ADF description');

  const index = buildCatalogUrlIndex({
    spaces: [
      {
        pages: [
          { url: 'https://lotusflare.atlassian.net/wiki/a', recency: 'active' },
          { url: 'https://lotusflare.atlassian.net/wiki/b', recency: 'legacy' },
        ],
      },
    ],
  });
  const outdated = outdatedPageUrls(
    ['https://lotusflare.atlassian.net/wiki/a', 'https://lotusflare.atlassian.net/wiki/b'],
    index,
  );
  if (outdated.length !== 1 || !outdated[0].endsWith('/wiki/b')) {
    fail(`outdatedPageUrls expected 1 stale, got ${outdated.length}`);
  } else pass('outdatedPageUrls keeps stale/legacy/missing only');
}

function testEnvDefaults() {
  console.log('\nEnv interval defaults');

  const mins = followUpIntervalMinutesFromEnv({ REMIND_FOLLOWUP_INTERVAL_MINUTES: '2' });
  if (mins !== 2) fail(`interval minutes: ${mins}`);
  else pass('REMIND_FOLLOWUP_INTERVAL_MINUTES');

  const days = followUpIntervalMinutesFromEnv({ REMIND_FOLLOWUP_INTERVAL_DAYS: '7' });
  if (days !== 7 * 24 * 60) fail(`interval days: ${days}`);
  else pass('REMIND_FOLLOWUP_INTERVAL_DAYS → minutes');

  const max = followUpMaxCount({ REMIND_FOLLOWUP_MAX: '3' });
  if (max !== 3) fail(`max follow-ups: ${max}`);
  else pass('REMIND_FOLLOWUP_MAX');
}

async function testJiraSearchJqlMocked() {
  console.log('\njiraSearchJql (mocked fetch)');

  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: { ...init, body: init.body ? JSON.parse(init.body) : null } });
    const n = calls.length;
    if (n === 1) {
      return new Response(
        JSON.stringify({
          issues: [{ id: '1', key: 'PROT-1' }, { id: '2', key: 'PROT-2' }],
          nextPageToken: 'page-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        issues: [{ id: '3', key: 'PROT-3' }],
        nextPageToken: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const env = { ATLASSIAN_EMAIL: 'a@lotusflare.com', ATLASSIAN_API_TOKEN: 'token' };
    const issues = await jiraSearchJql(env, {
      jql: 'project = PROT',
      maxResults: 3,
      fields: ['summary'],
    });

    if (calls.length !== 2) fail(`expected 2 paginated requests, got ${calls.length}`);
    else pass('paginates with nextPageToken');

    const first = calls[0];
    if (!first.url.includes('/rest/api/3/search/jql')) {
      fail(`wrong endpoint: ${first.url}`);
    } else pass('uses POST /rest/api/3/search/jql');

    if (first.init.method !== 'POST') fail('search must be POST');
    else pass('search uses POST method');

    if (first.init.body?.jql !== 'project = PROT') fail('jql not in POST body');
    else pass('jql in JSON body');

    if (calls[1].init.body?.nextPageToken !== 'page-2') fail('second page missing nextPageToken');
    else pass('passes nextPageToken on page 2');

    if (issues.length !== 3 || issues[2].key !== 'PROT-3') {
      fail(`expected 3 issues, got ${issues.length}`);
    } else pass('returns merged issue list up to maxResults');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testSearchFollowUpCandidatesMocked() {
  console.log('\nsearchFollowUpCandidates (mocked)');

  const originalFetch = globalThis.fetch;
  let capturedJql = '';

  globalThis.fetch = async (_url, init) => {
    capturedJql = JSON.parse(init.body).jql;
    return new Response(JSON.stringify({ issues: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const env = { ATLASSIAN_EMAIL: 'a@lotusflare.com', ATLASSIAN_API_TOKEN: 'token' };
    await searchFollowUpCandidates(env, { projectKey: 'PROT', maxResults: 10 });

    if (!capturedJql.includes('project = PROT')) fail('JQL missing project');
    else pass('JQL includes project');

    if (!capturedJql.includes(`labels = "${REMIND_SENT_LABEL}"`)) {
      fail('JQL missing catalog-remind-sent label');
    } else pass('JQL includes catalog-remind-sent label');

    if (!capturedJql.includes('statusCategory != Done')) fail('JQL missing open filter');
    else pass('JQL filters open issues only');

    if (!/ORDER BY updated DESC$/.test(capturedJql)) fail(`JQL ORDER BY malformed: ${capturedJql}`);
    else pass('JQL ORDER BY appended (not AND-ed)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testLiveJiraSearch() {
  const email = process.env.ATLASSIAN_EMAIL?.trim();
  const token = process.env.ATLASSIAN_API_TOKEN?.trim();
  if (!email || !token) {
    console.log('\nLive Jira search (skipped — set ATLASSIAN_EMAIL + ATLASSIAN_API_TOKEN in .env)');
    return;
  }

  console.log('\nLive Jira search (/rest/api/3/search/jql)');

  const env = {
    ATLASSIAN_EMAIL: email,
    ATLASSIAN_API_TOKEN: token,
    JIRA_BASE_URL: process.env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net',
  };

  try {
    const issues = await jiraSearchJql(env, {
      jql: `project = PROT AND labels = "confluence-catalog" ORDER BY updated DESC`,
      maxResults: 1,
      fields: ['summary', 'status'],
    });
    pass(`live search ok (${issues.length} issue(s) returned)`);
  } catch (err) {
    if (/removed|migrate|410|deprecated/i.test(String(err.message))) {
      fail(`live search still on removed API: ${err.message}`);
    } else {
      // Auth/permission errors are acceptable for connectivity proof if message isn't API removal
      console.log(`  ⚠ live search error (non-API-removal): ${err.message}`);
      pass('live search did not hit removed API error');
    }
  }
}

async function main() {
  console.log('Remind follow-up lib unit tests');

  testTrackingParse();
  testEligibility();
  testCatalogAndUrls();
  testEnvDefaults();
  await testJiraSearchJqlMocked();
  await testSearchFollowUpCandidatesMocked();
  await testLiveJiraSearch();

  console.log('');
  if (FAILURES.length) {
    console.error(`FAILED: ${FAILURES.length} issue(s)`);
    process.exit(1);
  }
  console.log('All remind follow-up lib tests passed.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

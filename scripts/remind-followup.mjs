#!/usr/bin/env node
/**
 * Run remind follow-ups: Slack DM + Jira comment (via Worker).
 *
 * Usage:
 *   node scripts/remind-followup.mjs
 *   node scripts/remind-followup.mjs --interval-minutes 2
 *   node scripts/remind-followup.mjs --issue PROT-123 --force
 *   node scripts/remind-followup.mjs --dry-run
 */
import { loadEnv } from './load-env.js';
import {
  buildCatalogUrlIndex,
  callWorkerFollowUp,
  followUpIntervalMinutesFromEnv,
  followUpMaxCount,
  isEligibleForFollowUp,
  loadCatalog,
  loadIssueTracking,
  outdatedPageUrls,
  extractPageUrlsFromIssue,
  searchFollowUpCandidates,
  jiraFetch,
} from './lib/remind-followup-lib.mjs';

loadEnv();

function parseArgs(argv) {
  const out = {
    intervalMinutes: followUpIntervalMinutesFromEnv(),
    maxFollowUps: followUpMaxCount(),
    issue: '',
    force: false,
    dryRun: false,
    ignoreStaleCheck: process.env.REMIND_FOLLOWUP_IGNORE_STALE === 'true',
    catalogPath: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--interval-minutes' && argv[i + 1]) {
      out.intervalMinutes = Number(argv[++i]) || out.intervalMinutes;
    } else if (a === '--max-followups' && argv[i + 1]) {
      out.maxFollowUps = Number(argv[++i]) || out.maxFollowUps;
    } else if (a === '--issue' && argv[i + 1]) {
      out.issue = String(argv[++i]).trim();
    } else if (a === '--catalog' && argv[i + 1]) {
      out.catalogPath = argv[++i];
    } else if (a === '--force') {
      out.force = true;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--ignore-stale-check') {
      out.ignoreStaleCheck = true;
    }
  }
  return out;
}

async function fetchIssue(env, issueKey) {
  return jiraFetch(
    env,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,labels,description,assignee`,
  );
}

async function processIssue(env, worker, issue, opts, catalogIndex) {
  const key = issue.key;
  const tracking = await loadIssueTracking(env, key);
  const eligibility = isEligibleForFollowUp(tracking, {
    intervalMinutes: opts.intervalMinutes,
    maxFollowUps: opts.maxFollowUps,
    force: opts.force,
  });

  if (!eligibility.eligible) {
    console.log(`  skip ${key}: ${eligibility.reason}${eligibility.nextEligibleAt ? ` (next ${eligibility.nextEligibleAt})` : ''}`);
    return { key, skipped: true, reason: eligibility.reason };
  }

  const pageUrls = extractPageUrlsFromIssue(issue);
  const stillOutdated = outdatedPageUrls(pageUrls, catalogIndex);
  if (!opts.ignoreStaleCheck && pageUrls.length && stillOutdated.length === 0) {
    console.log(`  skip ${key}: pages no longer outdated in catalog`);
    return { key, skipped: true, reason: 'pages_fresh' };
  }

  if (opts.ignoreStaleCheck && pageUrls.length && stillOutdated.length === 0) {
    console.log(`  note ${key}: pages are fresh in catalog — sending anyway (ignore-stale-check)`);
  }

  console.log(`  follow-up ${key} (${stillOutdated.length || pageUrls.length || '?'} pages)`);
  const result = await callWorkerFollowUp(worker, {
    jiraIssueKey: key,
    force: opts.force,
    dryRun: opts.dryRun,
    intervalMinutes: opts.intervalMinutes,
  });

  if (result.skipped) {
    console.log(`    worker skipped: ${result.reason}`);
  } else if (result.ok) {
    console.log(
      `    ok — slack=${result.slack?.ok} comment=${result.jiraComment?.ok}`,
    );
  } else {
    console.error(`    failed: ${result.error || 'unknown'}`);
  }
  return { key, ...result };
}

async function main() {
  const opts = parseArgs(process.argv);
  const env = {
    ATLASSIAN_EMAIL: process.env.ATLASSIAN_EMAIL,
    ATLASSIAN_API_TOKEN: process.env.ATLASSIAN_API_TOKEN,
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
  };
  const worker = {
    workerUrl: process.env.VITE_REMIND_TRACK_URL,
    apiSecret: process.env.REMIND_API_SECRET || process.env.VITE_REMIND_API_KEY,
  };

  console.log(
    `Remind follow-up — interval ${opts.intervalMinutes} min, max ${opts.maxFollowUps}, force=${opts.force}, ignoreStale=${opts.ignoreStaleCheck}, dryRun=${opts.dryRun}`,
  );

  const catalog = loadCatalog(opts.catalogPath || undefined);
  const catalogIndex = buildCatalogUrlIndex(catalog);

  let issues = [];
  if (opts.issue) {
    issues = [await fetchIssue(env, opts.issue)];
  } else {
    issues = await searchFollowUpCandidates(env);
    console.log(`Found ${issues.length} open remind issue(s) with label ${'catalog-remind-sent'}`);
  }

  const results = [];
  for (const issue of issues) {
    try {
      results.push(await processIssue(env, worker, issue, opts, catalogIndex));
    } catch (err) {
      console.error(`  error ${issue.key}: ${err.message}`);
      results.push({ key: issue.key, ok: false, error: err.message });
    }
  }

  const sent = results.filter((r) => r.ok && !r.skipped && !r.dryRun);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => r.ok === false && !r.skipped);

  console.log(`\nDone: ${sent.length} sent, ${skipped.length} skipped, ${failed.length} failed`);
  if (failed.length) process.exit(1);
  if (opts.issue && skipped.length && !sent.length && !opts.dryRun) {
    console.error(`Follow-up for ${opts.issue} was skipped (${skipped[0]?.reason})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * E2E test: wait for follow-up interval, then send Slack + Jira comment + email.
 *
 * Prerequisite: send a first Slack DM from the catalog for the issue (creates tracking).
 *
 * Usage:
 *   node scripts/test-remind-followup.mjs --issue PROT-123
 *   node scripts/test-remind-followup.mjs --issue PROT-123 --wait-minutes 2
 *   node scripts/test-remind-followup.mjs --issue PROT-123 --skip-wait --force
 */
import { loadEnv } from './load-env.js';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

loadEnv();

function parseArgs(argv) {
  const out = {
    issue: '',
    waitMinutes: Number(process.env.REMIND_FOLLOWUP_TEST_WAIT_MINUTES) || 2,
    skipWait: false,
    force: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--issue' && argv[i + 1]) out.issue = String(argv[++i]).trim();
    else if (a === '--wait-minutes' && argv[i + 1]) out.waitMinutes = Number(argv[++i]) || 2;
    else if (a === '--skip-wait') out.skipWait = true;
    else if (a === '--force') out.force = true;
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.issue) {
    console.error('Usage: node scripts/test-remind-followup.mjs --issue PROT-123 [--wait-minutes 2]');
    process.exit(1);
  }

  const workerUrl = (process.env.VITE_REMIND_TRACK_URL || '').replace(/\/$/, '');
  const secret = process.env.REMIND_API_SECRET || process.env.VITE_REMIND_API_KEY || '';
  if (!workerUrl || !secret) {
    console.error('Set VITE_REMIND_TRACK_URL and REMIND_API_SECRET in .env');
    process.exit(1);
  }

  console.log(`Follow-up E2E test for ${opts.issue}`);
  console.log(`Channels: Slack DM + Jira comment + email (via Worker /v1/remind/followup)`);

  if (!opts.skipWait && !opts.force) {
    const waitMs = Math.max(0, opts.waitMinutes) * 60 * 1000;
    console.log(`Waiting ${opts.waitMinutes} minute(s) after first Slack before follow-up…`);
    await sleep(waitMs);
  }

  const args = [
    join(root, 'scripts/remind-followup.mjs'),
    '--issue',
    opts.issue,
    '--interval-minutes',
    String(opts.waitMinutes),
    '--ignore-stale-check',
  ];
  if (opts.force) args.push('--force');
  if (opts.dryRun) args.push('--dry-run');

  const run = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      REMIND_FOLLOWUP_INTERVAL_MINUTES: String(opts.waitMinutes),
      REMIND_FOLLOWUP_IGNORE_STALE: 'true',
    },
  });

  if (run.status !== 0) {
    process.exit(run.status || 1);
  }

  if (opts.dryRun) {
    console.log('Dry run complete.');
    return;
  }

  console.log('\nVerify manually:');
  console.log(`  • Slack DM to assignee (follow-up header)`);
  console.log(`  • Jira comment with @mention on ${opts.issue}`);
  console.log(`  • Email to assignee inbox (Jira notify — may depend on user settings)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

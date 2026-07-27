#!/usr/bin/env node
/**
 * E2E: POST /v1/remind like the catalog (Slack only, no Jira).
 * Usage: node scripts/test-remind-worker-e2e.mjs "Editor Name" [slackUserId]
 */
import { loadEnv } from './load-env.js';
import { guessEmail } from '../src/lib/contact.js';

loadEnv();

const editor = process.argv[2]?.trim();
const slackUserId = process.argv[3]?.trim() || '';
const base = (process.env.VITE_REMIND_TRACK_URL || '').replace(/\/$/, '');
const secret = process.env.REMIND_API_SECRET || process.env.VITE_REMIND_API_KEY || '';

if (!editor || !base || !secret) {
  console.error(
    'Usage: node scripts/test-remind-worker-e2e.mjs "Editor Name" [slackUserId]\n' +
      'Needs VITE_REMIND_TRACK_URL and REMIND_API_SECRET (or VITE_REMIND_API_KEY) in .env',
  );
  process.exit(1);
}

const editorEmail = guessEmail(editor);
const message = `[catalog e2e] Remind test for ${editor} at ${new Date().toISOString()}`;

const payload = {
  editor,
  editorEmail: editorEmail || undefined,
  message,
  pagesCount: 1,
  partIndex: 1,
  partTotal: 1,
  catalogUrl: 'https://chenpan-star.github.io/lf-confluence-catalog/',
  sendSlack: true,
  createJira: false,
  slackUserId: slackUserId || undefined,
};

console.log('POST', `${base}/v1/remind`);
console.log('editor', editor, 'email', editorEmail || '(none)', 'slackUserId', slackUserId || '(worker resolves)');

const res = await fetch(`${base}/v1/remind`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log('HTTP', res.status);
console.log(JSON.stringify(data, null, 2));

if (!data.slack?.ok || !data.slack?.ts) {
  process.exit(1);
}

console.log('\nOK: Slack ts=', data.slack.ts, 'recipient=', data.slack.recipientName, data.slack.slackUserId);

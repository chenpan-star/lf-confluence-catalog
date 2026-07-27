#!/usr/bin/env node
/**
 * Verify Slack DM path used by the remind Worker (live API calls).
 *
 * Usage:
 *   node scripts/verify-remind-slack-delivery.mjs
 *   node scripts/verify-remind-slack-delivery.mjs --send-test "Chen Pan"
 *
 * Requires in .env: SLACK_BOT_TOKEN
 * Optional: VERIFY_SLACK_EDITOR, VERIFY_SLACK_EMAIL
 */
import { loadEnv } from './load-env.js';

loadEnv();

const token = (process.env.SLACK_BOT_TOKEN || '').trim();
const sendTest = process.argv.includes('--send-test');
const editorArg = process.argv.find((a, i) => process.argv[i - 1] === '--send-test');

const editor = (editorArg || process.env.VERIFY_SLACK_EDITOR || 'Chen Pan').trim();
const editorEmail =
  process.env.VERIFY_SLACK_EMAIL ||
  `${editor.split(/\s+/)[0]?.toLowerCase()}.${editor.split(/\s+/).pop()?.toLowerCase()}@lotusflare.com`;

if (!token) {
  console.error('FAIL: SLACK_BOT_TOKEN missing (set in .env)');
  process.exit(1);
}

async function slackCall(method, params = {}, { get = false } = {}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (typeof v === 'boolean') search.set(k, v ? 'true' : 'false');
    else search.set(k, String(v));
  }
  let res;
  if (get) {
    const url = new URL(`https://slack.com/api/${method}`);
    for (const [k, v] of search) url.searchParams.set(k, v);
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } else {
    res = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: search.toString(),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(`${method}: ${data.error || 'failed'}`);
  }
  return data;
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`OK: ${msg}`);
}

try {
  const auth = await slackCall('auth.test', {}, { get: true });
  pass(`auth.test bot=${auth.user_id} team=${auth.team}`);

  const lookup = await slackCall('users.lookupByEmail', { email: editorEmail.toLowerCase() }, { get: true });
  const user = lookup.user;
  if (!user?.id) fail('users.lookupByEmail returned no user id');
  pass(`lookupByEmail ${editorEmail} → ${user.id} (${user.profile?.real_name || user.name})`);

  const open = await slackCall('conversations.open', { users: user.id, return_im: true });
  const channelId = typeof open.channel === 'string' ? open.channel : open.channel?.id;
  if (!channelId) fail('conversations.open returned no channel id');
  pass(`conversations.open → DM channel ${channelId}`);

  const info = await slackCall('conversations.info', { channel: channelId }, { get: true }).catch(
    (e) => (String(e.message).includes('missing_scope') ? null : Promise.reject(e)),
  );
  if (info) {
    if (!info.channel?.is_im) fail('conversations.info: not an IM channel');
    if (info.channel.user && info.channel.user !== user.id) {
      fail(`DM channel user ${info.channel.user} !== expected ${user.id}`);
    }
    pass('conversations.info confirms IM with expected user');
  } else {
    console.log('SKIP: conversations.info (missing channels:read scope)');
  }

  if (!sendTest) {
    console.log('\nDry run complete (no message sent). Use --send-test to post a test DM.');
    process.exit(0);
  }

  const text = `[catalog verify] Test DM to ${editor} at ${new Date().toISOString()}`;
  const posted = await slackCall('chat.postMessage', { channel: channelId, text });
  if (!posted.ts) fail('chat.postMessage returned no ts');
  pass(`chat.postMessage ts=${posted.ts}`);

  const hist = await slackCall(
    'conversations.history',
    { channel: channelId, latest: posted.ts, oldest: posted.ts, inclusive: true, limit: 1 },
    { get: true },
  ).catch((e) => {
    if (String(e.message).includes('missing_scope')) return null;
    throw e;
  });
  if (hist) {
    const found = (hist.messages || []).some((m) => m.ts === posted.ts);
    if (!found) fail('conversations.history did not find posted message');
    pass('DM delivery verified in channel history');
  } else {
    console.log(
      'WARN: conversations.history missing_scope — message was posted (ts ok) but not verified in history. Add im:history to the Slack app.',
    );
  }
  console.log('\nAll checks passed. Recipient should see the test message from the bot.');
} catch (e) {
  fail(e.message);
}

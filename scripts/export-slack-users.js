/**
 * Export Slack workspace members → ID map for public/config/slack.json.
 *
 * Requires bot token with scope: users:read
 * (Add under OAuth & Permissions, then reinstall the app.)
 *
 * Usage:
 *   SLACK_BOT_TOKEN=xoxb-… npm run slack:export-users
 *   # or put SLACK_BOT_TOKEN in .env, then:
 *   npm run slack:export-users
 *   npm run slack:export-users -- --apply   # merge into public/config/slack.json
 *
 * Never commit the bot token.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './load-env.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SLACK_JSON = join(ROOT, 'public/config/slack.json');
const EXPORT_JSON = join(ROOT, 'data/slack-users-export.json');

function env(name) {
  return (process.env[name] || '').trim();
}

async function slackGet(token, method, params = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) {
    const err = data.error || `HTTP ${res.status}`;
    if (err === 'missing_scope') {
      throw new Error(
        'missing_scope — add Bot Token Scope users:read, reinstall the app, then retry.',
      );
    }
    throw new Error(`Slack ${method} failed: ${err}`);
  }
  return data;
}

async function listAllMembers(token) {
  const members = [];
  let cursor = '';
  do {
    const data = await slackGet(token, 'users.list', {
      limit: 200,
      cursor: cursor || undefined,
    });
    members.push(...(data.members || []));
    cursor = data.response_metadata?.next_cursor || '';
  } while (cursor);
  return members;
}

/** Build lookup keys → Slack member ID for catalog deep links. */
function buildUsersMap(members) {
  const users = {};
  const rows = [];

  for (const m of members) {
    if (!m?.id || m.is_bot || m.id === 'USLACKBOT' || m.deleted) continue;

    const profile = m.profile || {};
    const email = (profile.email || '').trim().toLowerCase();
    const realName = (profile.real_name || m.real_name || '').trim();
    const displayName = (profile.display_name || '').trim();
    const handle = (m.name || '').trim().toLowerCase();

    rows.push({
      id: m.id,
      name: handle,
      real_name: realName,
      display_name: displayName,
      email: email || null,
    });

    const add = (key) => {
      if (!key) return;
      if (!users[key]) users[key] = m.id;
    };

    add(realName);
    add(displayName);
    add(email);
    add(handle);
    if (handle) add(`@${handle}`);
    // first.last from email local-part (matches catalog guessSlackHandle)
    if (email.includes('@')) add(email.split('@')[0]);
  }

  return { users, rows };
}

function mergeSlackJson({ users, teamId, replaceUsers }) {
  let current = {};
  if (existsSync(SLACK_JSON)) {
    current = JSON.parse(readFileSync(SLACK_JSON, 'utf8'));
  }

  const next = {
    ...current,
    teamId: teamId || current.teamId || '',
    users: replaceUsers ? users : { ...(current.users || {}), ...users },
  };

  writeFileSync(SLACK_JSON, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const replaceUsers = process.argv.includes('--replace');
  const token = env('SLACK_BOT_TOKEN');
  if (!token) {
    console.error(
      'Missing SLACK_BOT_TOKEN.\n' +
        '  export SLACK_BOT_TOKEN=xoxb-…\n' +
        '  # or add SLACK_BOT_TOKEN=… to .env (gitignored)\n' +
        'Bot needs scope: users:read',
    );
    process.exit(1);
  }
  if (!token.startsWith('xoxb-') && !token.startsWith('xoxp-')) {
    console.error('SLACK_BOT_TOKEN should start with xoxb- (bot) or xoxp- (user).');
    process.exit(1);
  }

  console.log('Calling Slack auth.test…');
  const auth = await slackGet(token, 'auth.test');
  const teamId = auth.team_id || '';
  console.log(`Workspace: ${auth.team || '(unknown)'} (${teamId})`);

  console.log('Fetching users.list (paginated)…');
  const members = await listAllMembers(token);
  const { users, rows } = buildUsersMap(members);

  mkdirSync(dirname(EXPORT_JSON), { recursive: true });
  writeFileSync(
    EXPORT_JSON,
    `${JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        teamId,
        team: auth.team || null,
        memberCount: rows.length,
        members: rows,
        usersMap: users,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`People (non-bot): ${rows.length}`);
  console.log(`Lookup keys in map: ${Object.keys(users).length}`);
  console.log(`Wrote ${EXPORT_JSON} (gitignored raw export — do not commit if sensitive)`);

  if (apply) {
    mergeSlackJson({ users, teamId, replaceUsers });
    console.log(
      `Updated ${SLACK_JSON} (teamId + users map${replaceUsers ? ', replaced' : ', merged'}).`,
    );
    console.log('Commit public/config/slack.json if you want it on the live catalog.');
  } else {
    console.log('\nDry run only. To merge into public/config/slack.json:');
    console.log('  npm run slack:export-users -- --apply');
    console.log('Monthly CI uses: npm run slack:export-users -- --apply --replace');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

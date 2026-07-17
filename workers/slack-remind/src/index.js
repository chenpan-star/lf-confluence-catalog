/**
 * Cloudflare Worker: send Confluence review reminders via Slack DM.
 *
 * Secrets (wrangler secret put …):
 *   SLACK_BOT_TOKEN  — xoxb-… from Slack app
 *   REMIND_API_KEY   — shared key; catalog sends as X-Remind-Key
 *
 * Optional vars (wrangler.toml [vars]):
 *   ALLOWED_ORIGINS  — comma-separated origins (default: github.io + localhost)
 */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map();

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://chenpan-star.github.io',
];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function parseAllowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin, env) {
  const allowed = parseAllowedOrigins(env);
  const ok =
    origin &&
    (allowed.includes(origin) ||
      allowed.some((a) => a.endsWith('.github.io') && origin.endsWith('.github.io')));
  const allowOrigin = ok ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Remind-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function rateLimit(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX;
}

function guessEmail(name, domain = 'lotusflare.com') {
  if (!name) return null;
  const raw = String(name).replace(/\s*\(unlicensed\)\s*/gi, '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw.toLowerCase();
  if (/^[a-z0-9._-]+$/i.test(raw) && raw.includes('.')) {
    return `${raw.toLowerCase()}@${domain}`;
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (first && last) return `${first}.${last}@${domain}`;
  }
  return null;
}

async function slackApi(token, method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function defaultMessage(payload) {
  const {
    contactName,
    pageTitle,
    spaceName,
    spaceKey,
    confluenceUrl,
    catalogPageUrl,
  } = payload;
  const email = guessEmail(contactName);
  const handle = email ? email.split('@')[0] : null;
  const mention = handle ? `@${handle}` : contactName || 'there';
  const title = pageTitle || 'Untitled page';
  const space = spaceName || spaceKey || 'Unknown space';
  const key = spaceKey ? ` (${spaceKey})` : '';

  let text = `Hi ${mention},

Could you review this Confluence page? It may need updating, archiving, or deleting:

• *${title}*
• Space: ${space}${key}`;

  if (catalogPageUrl) text += `\n• Catalog: ${catalogPageUrl}`;
  if (confluenceUrl) text += `\n• Confluence: ${confluenceUrl}`;
  text += '\n\nThanks!\n_(Sent from the LF Confluence Catalog)_';
  return text;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true, service: 'slack-remind' }, 200, cors);
    }

    if (request.method !== 'POST' || url.pathname !== '/api/slack/remind') {
      return json({ ok: false, error: 'Not found' }, 404, cors);
    }

    const apiKey = env.REMIND_API_KEY;
    const provided = request.headers.get('X-Remind-Key') || '';
    if (!apiKey || provided !== apiKey) {
      return json({ ok: false, error: 'Unauthorized' }, 401, cors);
    }

    if (!env.SLACK_BOT_TOKEN) {
      return json({ ok: false, error: 'Slack bot not configured' }, 503, cors);
    }

    const ip = clientIp(request);
    if (!rateLimit(ip)) {
      return json({ ok: false, error: 'Too many requests — try again in a minute' }, 429, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, cors);
    }

    const contactName = (payload.contactName || '').trim();
    if (!contactName) {
      return json({ ok: false, error: 'contactName is required' }, 400, cors);
    }

    const email = (payload.email || '').trim().toLowerCase() || guessEmail(contactName);
    if (!email) {
      return json(
        { ok: false, error: 'Could not derive email for this person — use clipboard fallback' },
        400,
        cors,
      );
    }

    const message =
      (payload.message || '').trim() || defaultMessage({ ...payload, contactName });

    const lookup = await slackApi(env.SLACK_BOT_TOKEN, 'users.lookupByEmail', { email });
    if (!lookup.ok) {
      const reason =
        lookup.error === 'users_not_found'
          ? `No Slack user found for ${email}`
          : `Slack lookup failed: ${lookup.error || 'unknown'}`;
      return json({ ok: false, error: reason, email }, 404, cors);
    }

    const userId = lookup.user?.id;
    if (!userId) {
      return json({ ok: false, error: 'Slack user id missing', email }, 404, cors);
    }

    const opened = await slackApi(env.SLACK_BOT_TOKEN, 'conversations.open', {
      users: userId,
    });
    if (!opened.ok || !opened.channel?.id) {
      return json(
        { ok: false, error: `Could not open DM: ${opened.error || 'unknown'}`, email },
        502,
        cors,
      );
    }

    const posted = await slackApi(env.SLACK_BOT_TOKEN, 'chat.postMessage', {
      channel: opened.channel.id,
      text: message,
      unfurl_links: false,
      unfurl_media: false,
    });
    if (!posted.ok) {
      return json(
        { ok: false, error: `Could not send DM: ${posted.error || 'unknown'}`, email },
        502,
        cors,
      );
    }

    return json(
      {
        ok: true,
        email,
        slackUserId: userId,
        channelId: opened.channel.id,
        ts: posted.ts,
      },
      200,
      cors,
    );
  },
};

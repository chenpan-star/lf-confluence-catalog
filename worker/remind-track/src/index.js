/**
 * POST /v1/remind — create a Jira task when someone sends a catalog reminder.
 * Auth: Authorization: Bearer <REMIND_API_SECRET>
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const match = allowed.find((o) => o === origin || origin.startsWith(o.replace(/\/$/, '')));
  const allowOrigin = match || allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env) },
  });
}

function unauthorized(request, env) {
  return jsonResponse({ error: 'Unauthorized' }, 401, request, env);
}

function authorize(request, env) {
  const secret = env.REMIND_API_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match && match[1].trim() === secret;
}

function textToAdf(text) {
  const blocks = String(text || '').split(/\n\n+/);
  const content = blocks.map((block) => {
    const lines = block.split('\n');
    const inline = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i]) inline.push({ type: 'text', text: lines[i] });
      if (i < lines.length - 1) inline.push({ type: 'hardBreak' });
    }
    return {
      type: 'paragraph',
      content: inline.length ? inline : [{ type: 'text', text: ' ' }],
    };
  });
  return { type: 'doc', version: 1, content: content.length ? content : [{ type: 'paragraph', content: [] }] };
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

async function jiraFetch(env, path, init = {}) {
  const base = (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');
  const email = env.ATLASSIAN_EMAIL?.trim();
  const token = env.ATLASSIAN_API_TOKEN?.trim();
  if (!email || !token) {
    throw new Error('Jira credentials are not configured on the worker');
  }
  const auth = btoa(`${email}:${token}`);
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
    const msg =
      data?.errorMessages?.join('; ') ||
      data?.errors?.summary ||
      data?.message ||
      `Jira HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function findAssigneeAccountId(env, projectKey, editor, editorEmail) {
  const queries = [editorEmail, editor].filter(Boolean);
  for (const query of queries) {
    const params = new URLSearchParams({ project: projectKey, query, maxResults: '5' });
    const users = await jiraFetch(env, `/rest/api/3/user/assignable/search?${params}`);
    if (Array.isArray(users) && users[0]?.accountId) return users[0].accountId;
  }
  return null;
}

async function createRemindIssue(env, body) {
  const projectKey = (body.projectKey || env.JIRA_PROJECT_KEY || '').trim();
  if (!projectKey) throw new Error('JIRA_PROJECT_KEY is not configured');

  const issueType = (body.issueType || env.JIRA_ISSUE_TYPE || 'Task').trim();
  const editor = (body.editor || '').trim() || 'Unknown editor';
  const partIndex = Number(body.partIndex) || 1;
  const partTotal = Number(body.partTotal) || 1;
  const pagesCount = Number(body.pagesCount) || 0;
  const message = String(body.message || '').trim();
  const catalogUrl = String(body.catalogUrl || '').trim();

  const partLabel = partTotal > 1 ? ` (part ${partIndex}/${partTotal})` : '';
  const summary = truncate(
    `[Confluence review] ${editor}${partLabel} — ${pagesCount} outdated page${pagesCount === 1 ? '' : 's'}`,
    250,
  );

  const descriptionParts = [
    message,
    '',
    '---',
    `Created from LF Confluence catalog reminder.`,
    catalogUrl ? `Catalog: ${catalogUrl}` : '',
  ].filter(Boolean);

  const labels = Array.isArray(body.labels)
    ? body.labels.map((l) => String(l).trim()).filter(Boolean)
    : (env.JIRA_LABELS || 'confluence-catalog,doc-review')
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

  const fields = {
    project: { key: projectKey },
    issuetype: { name: issueType },
    summary,
    description: textToAdf(descriptionParts.join('\n')),
    labels,
  };

  const assigneeId = await findAssigneeAccountId(
    env,
    projectKey,
    editor,
    body.editorEmail?.trim(),
  );
  if (assigneeId) fields.assignee = { id: assigneeId };

  const created = await jiraFetch(env, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  const base = (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');
  return {
    issueKey: created.key,
    issueId: created.id,
    issueUrl: `${base}/browse/${created.key}`,
    assigneeSet: Boolean(assigneeId),
  };
}

async function sendSlackDirectMessage(env, { slackUserId, message }) {
  const token = env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN is not configured on the worker');
  }
  const channel = String(slackUserId || '').trim();
  if (!channel) {
    throw new Error('slackUserId is required');
  }
  const text = String(message || '').trim();
  if (!text) {
    throw new Error('message is required');
  }
  if (text.length > 3900) {
    throw new Error('Message is too long for Slack — send a smaller part');
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      mrkdwn: true,
      unfurl_links: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(data.error || 'Slack chat.postMessage failed');
  }
  return { channel: data.channel, ts: data.ts };
}

async function handleRemindRequest(env, body) {
  const slackUserId = String(body.slackUserId || '').trim();
  const wantsSlack = body.sendSlack === true && Boolean(slackUserId);
  const wantsJira = body.createJira !== false;

  const out = { ok: false, slack: null, jira: null };

  if (wantsSlack) {
    try {
      const slack = await sendSlackDirectMessage(env, {
        slackUserId,
        message: body.message,
      });
      out.slack = { ok: true, ...slack };
    } catch (err) {
      out.slack = { ok: false, error: err?.message || 'Slack send failed' };
    }
  }

  if (wantsJira) {
    try {
      const jira = await createRemindIssue(env, body);
      out.jira = { ok: true, ...jira };
    } catch (err) {
      out.jira = { ok: false, error: err?.message || 'Jira create failed' };
    }
  }

  out.ok = Boolean(out.slack?.ok || out.jira?.ok);
  if ((wantsSlack || wantsJira) && !out.ok) {
    const parts = [];
    if (out.slack && !out.slack.ok) parts.push(`Slack: ${out.slack.error}`);
    if (out.jira && !out.jira.ok) parts.push(`Jira: ${out.jira.error}`);
    out.error = parts.join(' · ') || 'Remind dispatch failed';
  }

  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
      return jsonResponse(
        {
          ok: true,
          service: 'lf-catalog-remind-track',
          jiraConfigured: Boolean(env.ATLASSIAN_EMAIL && env.ATLASSIAN_API_TOKEN),
          slackConfigured: Boolean(env.SLACK_BOT_TOKEN?.trim()),
        },
        200,
        request,
        env,
      );
    }

    if (request.method !== 'POST' || url.pathname !== '/v1/remind') {
      return jsonResponse({ error: 'Not found' }, 404, request, env);
    }

    if (!authorize(request, env)) {
      return unauthorized(request, env);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, request, env);
    }

    try {
      const result = await handleRemindRequest(env, body);
      const status = result.ok ? 201 : 502;
      return jsonResponse(result, status, request, env);
    } catch (err) {
      return jsonResponse(
        { ok: false, error: err?.message || 'Failed to process remind request' },
        502,
        request,
        env,
      );
    }
  },
};

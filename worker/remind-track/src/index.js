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
  let allowOrigin = allowed.find((o) => o === origin);
  if (!allowOrigin && origin.endsWith('.github.io')) allowOrigin = origin;
  if (!allowOrigin && origin.includes('lotusflare.com')) allowOrigin = origin;
  if (!allowOrigin) allowOrigin = allowed[0] || '*';
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
      if (lines[i]) inline.push(...lineToAdfInlines(lines[i]));
      if (i < lines.length - 1) inline.push({ type: 'hardBreak' });
    }
    return {
      type: 'paragraph',
      content: inline.length ? inline : [{ type: 'text', text: ' ' }],
    };
  });
  return { type: 'doc', version: 1, content: content.length ? content : [{ type: 'paragraph', content: [] }] };
}

function adfText(text, marks = undefined) {
  const node = { type: 'text', text: String(text) };
  if (marks?.length) node.marks = marks;
  return node;
}

function adfLink(label, href) {
  return adfText(label, [{ type: 'link', attrs: { href } }]);
}

function adfParagraph(...nodes) {
  const content = nodes.flat().filter(Boolean);
  return {
    type: 'paragraph',
    content: content.length ? content : [adfText(' ')],
  };
}

function adfHeading(level, text) {
  return { type: 'heading', attrs: { level }, content: [adfText(text)] };
}

function adfBulletList(listItems) {
  return {
    type: 'bulletList',
    content: listItems.map((blocks) => ({
      type: 'listItem',
      content: blocks,
    })),
  };
}

const URL_IN_TEXT = /https:\/\/[^\s<>"')\]]+/g;

/** Turn one line into ADF inlines (links + *bold*). */
function lineToAdfInlines(line) {
  const out = [];
  let rest = String(line);
  while (rest.length) {
    const urlMatch = rest.match(URL_IN_TEXT);
    const urlAt = urlMatch ? rest.indexOf(urlMatch[0]) : -1;
    const boldMatch = rest.match(/\*([^*]+)\*/);
    const boldAt = boldMatch ? rest.indexOf(boldMatch[0]) : -1;

    let next = -1;
    let kind = null;
    if (urlAt >= 0 && (boldAt < 0 || urlAt <= boldAt)) {
      next = urlAt;
      kind = 'url';
    } else if (boldAt >= 0) {
      next = boldAt;
      kind = 'bold';
    }

    if (next < 0) {
      if (rest) out.push(adfText(rest));
      break;
    }
    if (next > 0) out.push(adfText(rest.slice(0, next)));
    if (kind === 'url') {
      const href = urlMatch[0];
      out.push(adfLink(href, href));
      rest = rest.slice(next + href.length);
    } else {
      out.push(adfText(boldMatch[1], [{ type: 'strong' }]));
      rest = rest.slice(next + boldMatch[0].length);
    }
  }
  return out.length ? out : [adfText(' ')];
}

function parseRemindPagesFromMessage(message) {
  const text = String(message || '');
  const pages = [];
  const numbered =
    /(\d+)\.\s+\*([^*]+)\*\s+\(([^)]+)\)[^\n]*\n[ \t]*(https:\/\/[^\s]+)/g;
  let m;
  while ((m = numbered.exec(text)) !== null) {
    pages.push({ n: m[1], title: m[2].trim(), meta: m[3].trim(), url: m[4].trim() });
  }
  if (pages.length) return pages;

  const title = text.match(/•\s+\*([^*]+)\*/)?.[1]?.trim();
  const confUrl = text.match(/•\s+Confluence:\s*(https:\/\/[^\s]+)/i)?.[1]?.trim();
  const space = text.match(/•\s+Space:\s*([^\n]+)/)?.[1]?.trim();
  if (title && confUrl) {
    pages.push({
      n: '1',
      title,
      meta: space || '',
      url: confUrl,
    });
  }
  return pages;
}

function buildRemindDescriptionAdf({ editor, message, catalogUrl, pagesCount, partIndex, partTotal }) {
  const partNote =
    partTotal > 1 ? `Part ${partIndex} of ${partTotal} · ${pagesCount} page${pagesCount === 1 ? '' : 's'}` : `${pagesCount} page${pagesCount === 1 ? '' : 's'}`;

  const content = [
    adfHeading(2, 'Confluence documentation review'),
    adfParagraph(
      adfText('Assignee context: '),
      adfText(editor, [{ type: 'strong' }]),
      adfText(` · ${partNote}`),
    ),
    adfParagraph(
      adfText(
        'Please review the pages below — update, archive, or delete as appropriate.',
      ),
    ),
  ];

  const pages = parseRemindPagesFromMessage(message);
  if (pages.length) {
    content.push(adfHeading(3, 'Pages'));
    content.push(
      adfBulletList(
        pages.map((p) => [
          adfParagraph(
            adfText(`${p.n}. `),
            adfText(p.title, [{ type: 'strong' }]),
            p.meta ? adfText(` (${p.meta})`) : null,
          ),
          adfParagraph(adfLink('Open in Confluence', p.url)),
        ]),
      ),
    );
  } else {
    content.push(adfHeading(3, 'Reminder text'));
    content.push(...String(message || '').split(/\n\n+/).map((block) => {
      const lines = block.split('\n');
      const inline = [];
      for (let i = 0; i < lines.length; i += 1) {
        inline.push(...lineToAdfInlines(lines[i]));
        if (i < lines.length - 1) inline.push({ type: 'hardBreak' });
      }
      return adfParagraph(...inline);
    }));
  }

  content.push({ type: 'rule' });
  content.push(
    adfParagraph(
      adfText('Created from the '),
      catalogUrl ? adfLink('LF Confluence catalog', catalogUrl) : adfText('LF Confluence catalog'),
      adfText(' remind flow.'),
    ),
  );

  return { type: 'doc', version: 1, content };
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
    const fieldErrors =
      data?.errors && typeof data.errors === 'object'
        ? Object.entries(data.errors)
            .map(([k, v]) => `${k === 'summary' ? 'Summary' : k}: ${v}`)
            .join('; ')
        : '';
    const msg =
      data?.errorMessages?.join('; ') ||
      fieldErrors ||
      data?.message ||
      `Jira HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function calendarDateInTimeZone(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/** Add N Mon–Fri days after `isoDate` (YYYY-MM-DD); does not count `isoDate` as a working day. */
function addWorkingDays(isoDate, workingDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < workingDays) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return dt.toISOString().slice(0, 10);
}

function defaultRequestedDueDate(env) {
  const workingDays =
    Number(env.JIRA_DUE_DATE_WORKING_DAYS) || Number(env.JIRA_DUE_DATE_DAYS) || 14;
  const tz = (env.JIRA_DUE_DATE_TIMEZONE || 'Asia/Singapore').trim();
  const today = calendarDateInTimeZone(tz);
  return addWorkingDays(today, workingDays);
}

/** Fill required Jira fields (e.g. PROT "Requested Due Date") from create metadata. */
async function applyRequiredJiraFields(env, projectKey, issueType, fields) {
  const params = new URLSearchParams({
    projectKeys: projectKey,
    issuetypeNames: issueType,
    expand: 'projects.issuetypes.fields',
  });
  const meta = await jiraFetch(env, `/rest/api/3/issue/createmeta?${params}`);
  const issueTypes = meta.projects?.[0]?.issuetypes || [];
  const typeMeta =
    issueTypes.find((t) => t.name?.toLowerCase() === issueType.toLowerCase()) || issueTypes[0];
  const fieldSpecs = typeMeta?.fields || {};
  const dueDefault = defaultRequestedDueDate(env);
  const explicitField = (env.JIRA_REQUESTED_DUE_DATE_FIELD || '').trim();

  if (explicitField && !fields[explicitField]) {
    fields[explicitField] = dueDefault;
  }

  for (const [fieldId, spec] of Object.entries(fieldSpecs)) {
    if (!spec?.required || fields[fieldId] != null) continue;
    const name = String(spec.name || '').toLowerCase();
    const schema = spec.schema || {};
    if (schema.type === 'date' || name.includes('due date')) {
      fields[fieldId] = dueDefault;
    }
  }
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

  const labels = Array.isArray(body.labels)
    ? body.labels.map((l) => String(l).trim()).filter(Boolean)
    : (env.JIRA_LABELS || 'confluence-catalog,doc-review')
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

  const priorityName = (body.priorityName || env.JIRA_PRIORITY_NAME || 'Major').trim();

  const fields = {
    project: { key: projectKey },
    issuetype: { name: issueType },
    summary,
    description: buildRemindDescriptionAdf({
      editor,
      message,
      catalogUrl,
      pagesCount,
      partIndex,
      partTotal,
    }),
    labels,
    priority: { name: priorityName },
  };

  const assigneeId = await findAssigneeAccountId(
    env,
    projectKey,
    editor,
    body.editorEmail?.trim(),
  );
  if (assigneeId) fields.assignee = { id: assigneeId };

  await applyRequiredJiraFields(env, projectKey, issueType, fields);

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

async function slackApi(env, method, params = {}) {
  const token = env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error('SLACK_BOT_TOKEN is not configured on the worker');

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (typeof v === 'boolean') search.set(k, v ? 'true' : 'false');
    else search.set(k, String(v));
  }

  const getMethods = new Set(['users.info', 'users.lookupByEmail', 'auth.test']);
  let res;
  if (getMethods.has(method)) {
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
    const err = data.error || `${method} failed`;
    const meta = data.response_metadata?.messages?.filter(Boolean).join('; ');
    const detail = meta ? ` — ${meta}` : '';
    let hint = '';
    if (err === 'missing_scope') {
      hint =
        ' (add chat:write, im:write, im:history, channels:read, users:read, and users:read.email to the Slack app, then reinstall)';
    } else if (err === 'user_not_found') {
      hint =
        ' (stale slack.json id or wrong workspace — use the same SLACK_BOT_TOKEN for export and the Worker, or re-run slack:export-users --apply)';
    } else if (err === 'invalid_arguments') {
      hint = ' (Slack rejected request parameters — check bot scopes and user id)';
    } else if (err === 'cannot_dm_user') {
      hint = ' (recipient has DMs from apps disabled or bot is not allowed to DM them)';
    }
    const e = new Error(`${err} (${method})${detail}${hint}`);
    e.slackError = err;
    throw e;
  }
  return data;
}

async function slackLookupUserByEmail(env, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  try {
    const data = await slackApi(env, 'users.lookupByEmail', { email: normalized });
    return data.user || null;
  } catch (err) {
    if (err.slackError === 'users_not_found') return null;
    throw err;
  }
}

async function slackGetUser(env, slackUserId) {
  const id = String(slackUserId || '').trim();
  if (!id) return null;
  try {
    const data = await slackApi(env, 'users.info', { user: id });
    return data.user || null;
  } catch (err) {
    if (err.slackError === 'user_not_found') return null;
    throw err;
  }
}

async function resolveSlackUserForRemind(env, { slackUserId, editor, editorEmail }) {
  const emails = [...new Set(
    [editorEmail, guessEmailFromEditor(editor)]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase()),
  )];

  for (const email of emails) {
    const user = await slackLookupUserByEmail(env, email);
    if (user?.id) {
      const profileEmail = user.profile?.email?.trim().toLowerCase();
      if (profileEmail && profileEmail !== email) {
        continue;
      }
      return { user, resolvedVia: 'email', matchedEmail: email };
    }
  }

  // Do not fall back to slack.json when we guessed an email — avoids DMing the wrong person.
  if (emails.length > 0) {
    throw new Error(
      `No Slack user with email ${emails.join(' or ')} for "${editor}". ` +
        'Confirm their Lotusflare email in Slack, re-run slack:export-users --apply, or use Copy & open.',
    );
  }

  const user = await slackGetUser(env, slackUserId);
  if (user?.id) return { user, resolvedVia: 'id', matchedEmail: null };

  throw new Error(
    `Slack user not found for "${editor}"` +
      ' (re-run npm run slack:export-users -- --apply and ensure Worker SLACK_BOT_TOKEN matches export token)',
  );
}

function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\(unlicensed\)\s*/gi, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessEmailFromEditor(editor) {
  const raw = String(editor || '').trim();
  if (!raw || raw.includes('@')) return raw.includes('@') ? raw.toLowerCase() : null;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const local = `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}`;
  return `${local}@lotusflare.com`;
}

function editorNameMatchesSlackUser(editor, user) {
  const profile = user.profile || {};
  const editorNorm = normalizePersonName(editor);
  const nameCandidates = [profile.real_name, profile.display_name, user.name].filter(Boolean);

  for (const name of nameCandidates) {
    if (normalizePersonName(name) === editorNorm) return true;
  }

  const parts = editorNorm.split(/\s+/).filter((p) => p.length > 1);
  if (parts.length >= 2) {
    for (const name of nameCandidates) {
      const sNorm = normalizePersonName(name);
      if (parts.every((p) => sNorm.includes(p))) return true;
    }
  }

  return false;
}

async function assertSlackUserMatchesEditor(user, editor, editorEmail) {
  if (!user || user.deleted) {
    throw new Error('Slack user not found or deactivated');
  }
  const profile = user.profile || {};
  if (editorNameMatchesSlackUser(editor, user)) return;

  const emails = [editorEmail, guessEmailFromEditor(editor), profile.email]
    .filter(Boolean)
    .map((e) => String(e).toLowerCase());
  const profileEmail = profile.email?.toLowerCase();
  if (profileEmail && emails.includes(profileEmail)) return;

  const who = profile.real_name || profile.display_name || user.name || user.id;
  throw new Error(
    `Slack recipient mismatch: catalog editor is "${editor}" but Slack user is "${who}". Update slack.json or contact Infra.`,
  );
}

async function openSlackDmChannel(env, slackUserId) {
  const user = String(slackUserId || '').trim();
  const data = await slackApi(env, 'conversations.open', {
    users: user,
    return_im: true,
  });
  const channel = data.channel;
  const channelId = typeof channel === 'string' ? channel : channel?.id;
  if (!channelId) throw new Error('Slack did not return a DM channel id');
  return channelId;
}

async function verifySlackDmDelivery(env, { channelId, messageTs, expectedUserId }) {
  let channelUser = expectedUserId;
  try {
    const info = await slackApi(env, 'conversations.info', { channel: channelId });
    const ch = info.channel;
    if (!ch?.is_im) {
      throw new Error(`Delivery verify failed: channel ${channelId} is not a DM`);
    }
    if (ch.user && expectedUserId && ch.user !== expectedUserId) {
      throw new Error(
        `Delivery verify failed: DM is with Slack user ${ch.user}, expected ${expectedUserId}`,
      );
    }
    channelUser = ch.user || expectedUserId;
  } catch (err) {
    if (err.slackError !== 'missing_scope') throw err;
  }

  try {
    const hist = await slackApi(env, 'conversations.history', {
      channel: channelId,
      latest: messageTs,
      oldest: messageTs,
      inclusive: true,
      limit: 1,
    });
    const msg = (hist.messages || []).find((m) => m.ts === messageTs);
    if (!msg) {
      throw new Error('Delivery verify failed: message not found in DM history');
    }
    return { verified: true, channelUser, verifyNote: null };
  } catch (err) {
    if (err.slackError === 'missing_scope') {
      return {
        verified: false,
        channelUser,
        verifyNote:
          'Slack accepted the message but history could not be checked — add im:history and channels:read to the app, reinstall, then retry.',
      };
    }
    throw err;
  }
}

async function postSlackDmText(env, channelId, text) {
  return slackApi(env, 'chat.postMessage', {
    channel: channelId,
    text,
  });
}

async function sendSlackDirectMessage(env, { slackUserId, message, editor, editorEmail }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('message is required');
  if (text.length > 3900) {
    throw new Error('Message is too long for Slack — send a smaller part');
  }
  const { user, resolvedVia, matchedEmail } = await resolveSlackUserForRemind(env, {
    slackUserId,
    editor,
    editorEmail,
  });
  await assertSlackUserMatchesEditor(user, editor, editorEmail);
  const resolvedUserId = user.id;
  const channel = await openSlackDmChannel(env, resolvedUserId);
  const data = await postSlackDmText(env, channel, text);
  if (!data?.ts) {
    throw new Error('Slack did not confirm message delivery (missing message id)');
  }

  const delivery = await verifySlackDmDelivery(env, {
    channelId: channel,
    messageTs: data.ts,
    expectedUserId: resolvedUserId,
  });

  const recipientName =
    user.profile?.real_name || user.profile?.display_name || user.name || editor;

  return {
    channel: typeof data.channel === 'string' ? data.channel : data.channel?.id || channel,
    ts: data.ts,
    slackUserId: resolvedUserId,
    recipientName,
    resolvedVia,
    matchedEmail: matchedEmail || null,
    verified: delivery.verified,
    verifyNote: delivery.verifyNote,
    dmUserId: delivery.channelUser,
  };
}

async function handleRemindRequest(env, body) {
  const slackUserId = String(body.slackUserId || '').trim();
  const wantsSlack =
    body.sendSlack === true &&
    Boolean(slackUserId || body.editorEmail?.trim() || body.editor?.trim());
  const wantsJira = body.createJira !== false;

  const out = { ok: false, slack: null, jira: null };

  if (wantsSlack) {
    try {
      const slack = await sendSlackDirectMessage(env, {
        slackUserId,
        message: body.message,
        editor: (body.editor || '').trim(),
        editorEmail: body.editorEmail?.trim(),
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

  const slackOk =
    !wantsSlack ||
    Boolean(out.slack?.ok && out.slack?.ts && (out.slack?.verified || out.slack?.verifyNote));
  const jiraOk = !wantsJira || Boolean(out.jira?.ok);
  out.ok = slackOk && jiraOk;

  if ((wantsSlack || wantsJira) && !out.ok) {
    const parts = [];
    if (wantsSlack && !slackOk) parts.push(`Slack: ${out.slack?.error || 'DM not delivered'}`);
    if (wantsJira && !jiraOk) parts.push(`Jira: ${out.jira?.error || 'create failed'}`);
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

    if (request.method === 'GET' && url.pathname === '/v1/auth-check') {
      if (!authorize(request, env)) return unauthorized(request, env);
      return jsonResponse({ ok: true, authorized: true }, 200, request, env);
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

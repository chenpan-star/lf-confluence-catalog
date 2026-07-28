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
  const lastUpdated = text.match(/•\s+Last updated:\s*([^\n]+)/i)?.[1]?.trim();
  if (title && confUrl) {
    const metaParts = [space, lastUpdated].filter(Boolean);
    pages.push({
      n: '1',
      title,
      meta: metaParts.join(' · '),
      url: confUrl,
    });
  }
  return pages;
}

/** Shared, friendly copy for Jira description + email (with light emoji). */
function remindCopyContext({ editor, pagesCount, partIndex, partTotal, pages, issueKey }) {
  const n = pages?.length || pagesCount || 0;
  const firstName = String(editor || '')
    .trim()
    .split(/\s+/)[0];
  const hi = firstName ? `👋 Hi ${firstName}!` : '👋 Hi there!';

  let intro;
  if (n === 1) {
    intro = 'Could you take a quick look at **1 Confluence page** that might be out of date?';
  } else if (n > 1) {
    intro = `Could you take a quick look at **${n} Confluence pages** that might be out of date?`;
  } else {
    intro = 'Could you take a quick look at some Confluence pages that might be out of date?';
  }
  if (partTotal > 1) {
    intro += ` _(Reminder ${partIndex} of ${partTotal}.)_`;
  }

  const action =
    '📝 **What to do:** Open each page → update it, archive it, or delete it if we do not need it anymore.';
  const pagesLabel = '📄 **Pages to check**';
  const taskLabel = issueKey ? '📌 **Your Jira task**' : null;
  const done = issueKey
    ? `✅ **All done?** Leave a short note on ${issueKey} or mark the task complete — whatever works for you.`
    : '✅ **All done?** Mark this task complete when you are finished.';
  const thanks = '🙏 Thanks for helping keep our docs accurate!';
  const openLink = '🔗 Open in Confluence';
  const catalogNote = '📚 Sent from the Confluence catalog.';

  return {
    n,
    hi,
    intro,
    action,
    pagesLabel,
    taskLabel,
    done,
    thanks,
    openLink,
    catalogNote,
    issueKey,
  };
}

/** Strip simple markdown bold/italic for plain text + email. */
function plainFriendly(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

/** Email clients: base typography (inline styles only). */
const REMIND_EMAIL_WRAP =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.6;color:#172B4D;max-width:640px";
const REMIND_EMAIL_P = 'margin:0 0 18px;font-size:17px;line-height:1.6';
const REMIND_EMAIL_LEAD = 'margin:0 0 20px;font-size:20px;line-height:1.45;font-weight:600';
const REMIND_EMAIL_SECTION = 'margin:24px 0 12px;font-size:18px;line-height:1.4;font-weight:600';
const REMIND_EMAIL_META = 'font-size:15px;line-height:1.5;color:#44546F';
const REMIND_EMAIL_LINK = 'font-size:17px;color:#0052CC';
const REMIND_EMAIL_BTN =
  'display:inline-block;margin:4px 0 20px;padding:14px 22px;font-size:17px;font-weight:600;color:#ffffff !important;background:#0052CC;text-decoration:none;border-radius:8px';

function wrapRemindEmailHtml(inner) {
  return `<div style="${REMIND_EMAIL_WRAP}">${inner}</div>`;
}

/** ADF blocks for the page list (readable in Jira UI; plain URLs help email/wiki export). */
function buildRemindPageListAdfContent(pages) {
  if (!pages.length) return [];
  return [
    adfHeading(3, '📄 Pages to check'),
    adfBulletList(
      pages.map((p) => {
        const items = [
          adfParagraph(
            adfText(p.title, [{ type: 'strong' }]),
            adfText(' — '),
            adfLink('Open in Confluence', p.url),
          ),
        ];
        if (p.meta) items.push(adfParagraph(adfText(p.meta)));
        items.push(adfParagraph(adfText(p.url)));
        return items;
      }),
    ),
  ];
}

/** Full issue description (paragraphs only — no headings — so Jira UI stays clean). */
function buildRemindDescriptionAdf({
  editor,
  message,
  catalogUrl,
  pagesCount,
  partIndex,
  partTotal,
  issueKey,
  issueUrl,
  summary,
}) {
  const pages = parseRemindPagesFromMessage(message);
  const copy = remindCopyContext({
    editor,
    pagesCount,
    partIndex,
    partTotal,
    pages,
    issueKey,
  });

  const content = [
    adfHeading(4, copy.hi),
    adfParagraph(adfText(plainFriendly(copy.intro))),
    adfParagraph(adfText(plainFriendly(copy.action))),
  ];

  if (issueKey && issueUrl) {
    content.push(
      adfParagraph(
        adfText('📌 Your Jira task: '),
        adfLink(issueKey, issueUrl),
      ),
    );
  }

  if (pages.length) {
    content.push(...buildRemindPageListAdfContent(pages));
  } else if (message?.trim()) {
    content.push(...String(message).split(/\n\n+/).map((block) => {
      const lines = block.split('\n');
      const inline = [];
      for (let i = 0; i < lines.length; i += 1) {
        inline.push(...lineToAdfInlines(lines[i]));
        if (i < lines.length - 1) inline.push({ type: 'hardBreak' });
      }
      return adfParagraph(...inline);
    }));
  }

  if (issueKey && issueUrl) {
    content.push(
      adfParagraph(
        adfText('✅ All done? '),
        adfLink(`Update ${issueKey}`, issueUrl),
        adfText(' when you finish. 🙏'),
      ),
    );
  }

  if (catalogUrl) {
    content.push({ type: 'rule' });
    content.push(
      adfParagraph(
        adfText('📚 Sent from '),
        adfLink('Confluence catalog', catalogUrl),
        adfText('.'),
      ),
    );
  }

  return { type: 'doc', version: 1, content };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain + HTML bodies for POST /issue/{key}/notify (and reference for Jira Automation copy). */
function buildRemindEmailBodies({
  editor,
  summary,
  issueKey,
  issueUrl,
  message,
  pagesCount,
  partIndex,
  partTotal,
}) {
  const pages = parseRemindPagesFromMessage(message);
  const copy = remindCopyContext({
    editor,
    pagesCount,
    partIndex,
    partTotal,
    pages,
    issueKey,
  });

  const textPageLines = [];
  if (pages.length) {
    textPageLines.push('📄 Pages to check:', '');
    for (const p of pages) {
      textPageLines.push(`  • ${p.title}`);
      if (p.meta) textPageLines.push(`    ${p.meta.replace(/,/g, ' ·')}`);
      textPageLines.push(`    🔗 ${p.url}`);
      textPageLines.push('');
    }
  } else if (message?.trim()) {
    textPageLines.push(String(message).trim(), '');
  }

  const textBody = [
    copy.hi,
    plainFriendly(copy.intro),
    '',
    plainFriendly(copy.action),
    '',
    issueKey ? `📌 Your Jira task ${issueKey}: ${issueUrl}` : null,
    issueKey ? '' : null,
    ...textPageLines,
    plainFriendly(copy.done),
    '',
    copy.thanks,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const pageListHtml =
    pages.length > 0
      ? pages
          .map(
            (p) =>
              `<li style="margin-bottom:20px;font-size:17px;line-height:1.55">` +
              `<div style="font-size:18px;font-weight:600;margin-bottom:6px">📄 ${escapeHtml(p.title)}</div>` +
              (p.meta
                ? `<div style="${REMIND_EMAIL_META};margin-bottom:8px">${escapeHtml(p.meta.replace(/,/g, ' ·'))}</div>`
                : '') +
              `<a href="${escapeHtml(p.url)}" style="${REMIND_EMAIL_LINK}">🔗 Open in Confluence</a></li>`,
          )
          .join('')
      : message?.trim()
        ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:16px;line-height:1.55">${escapeHtml(message.trim())}</pre>`
        : '';

  const htmlBody = wrapRemindEmailHtml(
    [
      `<p style="${REMIND_EMAIL_LEAD}">${escapeHtml(copy.hi)}</p>`,
      `<p style="${REMIND_EMAIL_P}">${escapeHtml(plainFriendly(copy.intro))}</p>`,
      `<p style="${REMIND_EMAIL_P}">${escapeHtml(plainFriendly(copy.action))}</p>`,
      issueKey
        ? `<p style="${REMIND_EMAIL_P}">📌 Your Jira task: <a href="${escapeHtml(issueUrl)}" style="${REMIND_EMAIL_LINK}"><strong>${escapeHtml(issueKey)}</strong></a></p>`
        : '',
      pageListHtml
        ? `<p style="${REMIND_EMAIL_SECTION}">📄 Pages to check</p><ul style="padding:0;margin:0 0 8px;list-style:none">${pageListHtml}</ul>`
        : '',
      `<p style="${REMIND_EMAIL_P}">${escapeHtml(plainFriendly(copy.done))}</p>`,
      issueKey
        ? `<a href="${escapeHtml(issueUrl)}" style="${REMIND_EMAIL_BTN}">Open ${escapeHtml(issueKey)} in Jira</a>`
        : '',
      `<p style="${REMIND_EMAIL_P};margin-top:8px">${escapeHtml(copy.thanks)}</p>`,
    ]
      .filter(Boolean)
      .join(''),
  );

  return { textBody, htmlBody, pages };
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

/** Add N calendar days after `isoDate` (YYYY-MM-DD). */
function addCalendarDays(isoDate, days) {
  const n = Math.max(0, Number(days) || 0);
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
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

function defaultStartDate(env) {
  const tz = (env.JIRA_DUE_DATE_TIMEZONE || 'Asia/Singapore').trim();
  return calendarDateInTimeZone(tz);
}

function defaultRequestedDueDate(env) {
  const tz = (env.JIRA_DUE_DATE_TIMEZONE || 'Asia/Singapore').trim();
  const today = calendarDateInTimeZone(tz);
  const workingDaysRaw = env.JIRA_DUE_DATE_WORKING_DAYS;
  if (workingDaysRaw != null && String(workingDaysRaw).trim() !== '') {
    return addWorkingDays(today, Number(workingDaysRaw) || 14);
  }
  const calendarDays = Number(env.JIRA_DUE_DATE_DAYS) || 14;
  return addCalendarDays(today, calendarDays);
}

function isRemindDueDateField(fieldId, fieldName) {
  const name = String(fieldName || '').toLowerCase();
  if (fieldId === 'duedate') return true;
  if (name === 'due date') return true;
  return false;
}

function isRequestedDueDateField(fieldId, fieldName, requestedFieldId = '') {
  if (requestedFieldId && fieldId === requestedFieldId) return true;
  const name = String(fieldName || '').toLowerCase();
  return name.includes('requested') && name.includes('due');
}

/** Jira field ids: Due date (duedate) vs PROT Requested Due Date (required on create). */
function remindJiraDateFieldConfig(env) {
  return {
    dueDateField: (env.JIRA_DUE_DATE_FIELD || 'duedate').trim() || 'duedate',
    requestedDueField: (env.JIRA_REQUESTED_DUE_DATE_FIELD || 'customfield_11063').trim(),
    startField: (env.JIRA_START_DATE_FIELD || 'customfield_10912').trim(),
  };
}

function buildRemindDateFieldValues(env) {
  const dueDefault = defaultRequestedDueDate(env);
  const startDefault = defaultStartDate(env);
  const { dueDateField, requestedDueField, startField } = remindJiraDateFieldConfig(env);
  const fields = {};
  fields[dueDateField] = dueDefault;
  if (requestedDueField && requestedDueField !== dueDateField) {
    fields[requestedDueField] = dueDefault;
  }
  if (startField) fields[startField] = startDefault;
  return { dueDefault, startDefault, fields, dueDateField, requestedDueField, startField };
}

/** Fill required Jira fields (e.g. PROT "Requested Due Date") from create metadata. */
async function applyRequiredJiraFields(env, projectKey, issueType, fields) {
  const { fields: dateFields } = buildRemindDateFieldValues(env);
  Object.assign(fields, dateFields);

  const params = new URLSearchParams({
    projectKeys: projectKey,
    issuetypeNames: issueType,
    expand: 'projects.issuetypes.fields',
  });
  let fieldSpecs = {};
  try {
    const meta = await jiraFetch(env, `/rest/api/3/issue/createmeta?${params}`);
    const issueTypes = meta.projects?.[0]?.issuetypes || [];
    const typeMeta =
      issueTypes.find((t) => t.name?.toLowerCase() === issueType.toLowerCase()) || issueTypes[0];
    fieldSpecs = typeMeta?.fields || {};
  } catch {
    /* createmeta optional — explicit PROT field ids already merged above */
  }

  const startDefault = defaultStartDate(env);
  const dueDefault = defaultRequestedDueDate(env);
  const { dueDateField, requestedDueField } = remindJiraDateFieldConfig(env);

  if (fields[dueDateField] == null) {
    fields[dueDateField] = dueDefault;
  }
  if (requestedDueField && fields[requestedDueField] == null) {
    fields[requestedDueField] = dueDefault;
  }

  for (const [fieldId, spec] of Object.entries(fieldSpecs)) {
    if (fields[fieldId] != null) continue;
    const name = String(spec.name || '');
    const schema = spec.schema || {};
    if (schema.type !== 'date') continue;
    if (isRemindDueDateField(fieldId, name)) {
      fields[fieldId] = dueDefault;
      continue;
    }
    if (isRequestedDueDateField(fieldId, name)) {
      fields[fieldId] = dueDefault;
      continue;
    }
    if (name.toLowerCase().includes('start')) {
      fields[fieldId] = startDefault;
    }
  }

  for (const [fieldId, spec] of Object.entries(fieldSpecs)) {
    if (!spec?.required || fields[fieldId] != null) continue;
    const name = String(spec.name || '');
    const schema = spec.schema || {};
    if (schema.type !== 'date') continue;
    if (isRequestedDueDateField(fieldId, name) || isRemindDueDateField(fieldId, name)) {
      fields[fieldId] = dueDefault;
    }
  }
}

/** Set Jira Due date (+ optional Requested Due Date / Start date). Due date is applied last. */
async function updateRemindIssueDates(env, issueKey) {
  const dueDefault = defaultRequestedDueDate(env);
  const startDefault = defaultStartDate(env);
  const { dueDateField, requestedDueField, startField } = remindJiraDateFieldConfig(env);
  const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}`;

  if (requestedDueField && requestedDueField !== dueDateField) {
    try {
      await jiraFetch(env, path, {
        method: 'PUT',
        body: JSON.stringify({ fields: { [requestedDueField]: dueDefault } }),
      });
    } catch {
      /* may already be set on create */
    }
  }

  const extraStart = {};
  if (startField) extraStart[startField] = startDefault;
  if (Object.keys(extraStart).length) {
    try {
      await jiraFetch(env, path, {
        method: 'PUT',
        body: JSON.stringify({ fields: extraStart }),
      });
    } catch {
      /* start date optional */
    }
  }

  await jiraFetch(env, path, {
    method: 'PUT',
    body: JSON.stringify({ fields: { [dueDateField]: dueDefault } }),
  });
}

async function findUserAccountIdByQuery(env, query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const params = new URLSearchParams({ query: q, maxResults: '5' });
  const users = await jiraFetch(env, `/rest/api/3/user/search?${params}`);
  if (Array.isArray(users) && users[0]?.accountId) return users[0].accountId;
  return null;
}

async function assignIssueWithNotify(env, issueKey, accountId) {
  await jiraFetch(
    env,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee?notifyUsers=true`,
    {
      method: 'PUT',
      body: JSON.stringify({ accountId }),
    },
  );
}

async function addIssueWatcher(env, issueKey, accountId) {
  await jiraFetch(env, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/watchers`, {
    method: 'POST',
    body: JSON.stringify(accountId),
  });
}

async function addRemindAssigneeComment(
  env,
  issueKey,
  accountId,
  { message, editor, pagesCount, partIndex, partTotal, issueUrl },
) {
  const pages = parseRemindPagesFromMessage(message);
  const copy = remindCopyContext({
    editor,
    pagesCount,
    partIndex,
    partTotal,
    pages,
    issueKey,
  });

  const content = [
    {
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          attrs: { id: accountId, text: '@assignee', accessLevel: '' },
        },
        {
          type: 'text',
          text: ` ${copy.hi}`,
          marks: [{ type: 'strong' }],
        },
      ],
    },
    adfParagraph(adfText(plainFriendly(copy.intro))),
    adfParagraph(adfText(plainFriendly(copy.action))),
    ...buildRemindPageListAdfContent(pages),
    adfParagraph(
      adfText('📌 Open task: '),
      adfLink(issueKey, issueUrl),
    ),
    adfParagraph(adfText(`${plainFriendly(copy.done)} ${copy.thanks}`)),
  ];

  await jiraFetch(env, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      body: { type: 'doc', version: 1, content },
    }),
  });
}

async function notifyIssueRecipient(
  env,
  issueKey,
  {
    summary,
    issueUrl,
    assigneeAccountId,
    editor,
    editorEmail,
    projectKey,
    pagesCount,
    message,
    partIndex,
    partTotal,
  },
) {
  if (String(env.JIRA_NOTIFY_ASSIGNEE || 'true').toLowerCase() === 'false') {
    return { skipped: true };
  }

  let accountId = assigneeAccountId || null;
  if (!accountId) {
    accountId = await findAssigneeAccountId(env, projectKey, editor, editorEmail);
  }
  if (!accountId) {
    accountId = await findUserAccountIdByQuery(env, editorEmail || editor);
  }

  if (!accountId) {
    return {
      ok: false,
      error: 'No Jira user found to email (could not match assignee / editor email)',
    };
  }

  const { textBody, htmlBody } = buildRemindEmailBodies({
    editor,
    summary,
    issueKey,
    issueUrl,
    message,
    pagesCount,
    partIndex,
    partTotal,
  });

  let assignNotifyOk = false;
  let watcherOk = false;
  let mentionOk = false;
  let notifyOk = false;
  let assignNotifyError = null;
  let watcherError = null;
  let mentionError = null;
  let notifyError = null;

  try {
    await assignIssueWithNotify(env, issueKey, accountId);
    assignNotifyOk = true;
  } catch (err) {
    assignNotifyError = err?.message || 'Assign with notify failed';
  }

  try {
    await addIssueWatcher(env, issueKey, accountId);
    watcherOk = true;
  } catch (err) {
    watcherError = err?.message || 'Add watcher failed';
  }

  try {
    await addRemindAssigneeComment(env, issueKey, accountId, {
      message,
      editor,
      pagesCount,
      partIndex,
      partTotal,
      issueUrl,
    });
    mentionOk = true;
  } catch (err) {
    mentionError = err?.message || 'Mention comment failed';
  }

  try {
    await jiraFetch(env, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/notify`, {
      method: 'POST',
      body: JSON.stringify({
        subject: summary,
        textBody,
        htmlBody,
        to: {
          assignee: true,
          reporter: false,
          watchers: true,
          users: [{ accountId }],
        },
      }),
    });
    notifyOk = true;
  } catch (err) {
    notifyError = err?.message || 'Jira notify failed';
  }

  const ok = assignNotifyOk || mentionOk || notifyOk;
  return {
    ok,
    emailedAccountId: accountId,
    assignNotifyOk,
    watcherOk,
    mentionOk,
    notifyOk,
    error: ok
      ? undefined
      : [assignNotifyError, watcherError, mentionError, notifyError]
          .filter(Boolean)
          .join(' · ') || 'Email notification failed',
    details: {
      assignNotifyError,
      watcherError,
      mentionError,
      notifyError,
    },
  };
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

/** Escape user text for JQL quoted string. */
function escapeJqlString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Open catalog remind issue with same summary (+ page URLs in description when known).
 * Returns null if none; skips when JIRA_DEDUP_DISABLE=true or body.forceRemind=true.
 */
async function findExistingOpenRemindIssue(
  env,
  { projectKey, summary, assigneeId, labels, message, forceRemind },
) {
  if (forceRemind) return null;
  if (String(env.JIRA_DEDUP_DISABLE || 'false').toLowerCase() === 'true') return null;

  const catalogLabel =
    (Array.isArray(labels) && labels.find((l) => String(l).includes('confluence-catalog'))) ||
    'confluence-catalog';
  const days = Math.max(0, Number(env.JIRA_DEDUP_DAYS) || 60);
  const escapedSummary = escapeJqlString(summary);

  let jql = `project = ${projectKey} AND labels = "${escapeJqlString(catalogLabel)}" AND summary ~ "${escapedSummary}" AND statusCategory != Done`;
  if (assigneeId) jql += ` AND assignee = "${escapeJqlString(assigneeId)}"`;
  if (days > 0) jql += ` AND created >= -${days}d`;
  jql += ' ORDER BY created DESC';

  const params = new URLSearchParams({
    jql,
    maxResults: '8',
    fields: 'summary,status,assignee,description',
  });

  let data;
  try {
    data = await jiraFetch(env, `/rest/api/3/search?${params}`);
  } catch {
    return null;
  }

  const issues = data?.issues;
  if (!Array.isArray(issues) || !issues.length) return null;

  const pageUrls = parseRemindPagesFromMessage(message)
    .map((p) => p.url)
    .filter(Boolean);

  const base = (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');

  for (const issue of issues) {
    if (!pageUrls.length) {
      return {
        key: issue.key,
        id: issue.id,
        issueUrl: `${base}/browse/${issue.key}`,
        assigneeSet: Boolean(issue.fields?.assignee?.accountId),
      };
    }
    const descBlob = JSON.stringify(issue.fields?.description || '');
    if (pageUrls.every((url) => descBlob.includes(url))) {
      return {
        key: issue.key,
        id: issue.id,
        issueUrl: `${base}/browse/${issue.key}`,
        assigneeSet: Boolean(issue.fields?.assignee?.accountId),
      };
    }
  }

  return null;
}

async function buildRemindDedupContext(env, body) {
  const projectKey = (body.projectKey || env.JIRA_PROJECT_KEY || '').trim();
  if (!projectKey) throw new Error('JIRA_PROJECT_KEY is not configured');

  const editor = (body.editor || '').trim() || 'Unknown editor';
  const partIndex = Number(body.partIndex) || 1;
  const partTotal = Number(body.partTotal) || 1;
  const pagesCount = Number(body.pagesCount) || 0;
  const message = String(body.message || '').trim();

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

  const assigneeId = await findAssigneeAccountId(
    env,
    projectKey,
    editor,
    body.editorEmail?.trim(),
  );

  return { projectKey, summary, assigneeId, labels, message };
}

async function lookupOpenRemindIssue(env, body) {
  const ctx = await buildRemindDedupContext(env, body);
  return findExistingOpenRemindIssue(env, {
    ...ctx,
    forceRemind: body.forceRemind === true,
  });
}

async function handleRemindLookup(env, body) {
  try {
    const existing = await lookupOpenRemindIssue(env, body);
    if (!existing) {
      return { ok: true, found: false, jira: null };
    }
    return {
      ok: true,
      found: true,
      jira: {
        ok: true,
        issueKey: existing.key,
        issueUrl: existing.issueUrl,
        duplicate: true,
      },
    };
  } catch (err) {
    return { ok: false, found: false, error: err?.message || 'Jira lookup failed' };
  }
}

async function createRemindIssue(env, body) {
  const { projectKey, summary, assigneeId, labels, message } = await buildRemindDedupContext(
    env,
    body,
  );

  const issueType = (body.issueType || env.JIRA_ISSUE_TYPE || 'Task').trim();
  const editor = (body.editor || '').trim() || 'Unknown editor';
  const partIndex = Number(body.partIndex) || 1;
  const partTotal = Number(body.partTotal) || 1;
  const pagesCount = Number(body.pagesCount) || 0;
  const catalogUrl = String(body.catalogUrl || '').trim();

  const priorityName = (body.priorityName || env.JIRA_PRIORITY_NAME || 'Major').trim();

  const fields = {
    project: { key: projectKey },
    issuetype: { name: issueType },
    summary,
    description: {
      type: 'doc',
      version: 1,
      content: [adfParagraph(adfText('📄 Loading Confluence page list…'))],
    },
    labels,
    priority: { name: priorityName },
  };

  if (assigneeId) {
    fields.assignee = { accountId: assigneeId };
  }

  const existing = await findExistingOpenRemindIssue(env, {
    projectKey,
    summary,
    assigneeId,
    labels,
    message,
    forceRemind: body.forceRemind === true,
  });

  if (existing) {
    return {
      issueKey: existing.key,
      issueId: existing.id,
      issueUrl: existing.issueUrl,
      assigneeSet: existing.assigneeSet,
      duplicate: true,
      notifyEmail: {
        skipped: true,
        reason: 'duplicate_open_issue',
        message: `Open task ${existing.key} already exists for this remind — not created again.`,
      },
    };
  }

  await applyRequiredJiraFields(env, projectKey, issueType, fields);

  const created = await jiraFetch(env, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  const base = (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');
  const issueUrl = `${base}/browse/${created.key}`;

  try {
    await jiraFetch(env, `/rest/api/3/issue/${encodeURIComponent(created.key)}`, {
      method: 'PUT',
      body: JSON.stringify({
        fields: {
          description: buildRemindDescriptionAdf({
            editor,
            message,
            catalogUrl,
            pagesCount,
            partIndex,
            partTotal,
            issueKey: created.key,
            issueUrl,
            summary,
          }),
        },
      }),
    });
  } catch (err) {
    throw new Error(
      `Issue ${created.key} created but description update failed: ${err?.message || err}`,
    );
  }

  let assigneeSet = Boolean(assigneeId);
  if (assigneeId) {
    try {
      await assignIssueWithNotify(env, created.key, assigneeId);
    } catch {
      assigneeSet = false;
    }
  }

  try {
    await updateRemindIssueDates(env, created.key);
  } catch (err) {
    throw new Error(
      `Issue ${created.key} created but Due date update failed: ${err?.message || err}`,
    );
  }

  const notifyEmail = await notifyIssueRecipient(env, created.key, {
    summary,
    issueUrl,
    assigneeAccountId: assigneeId,
    editor,
    editorEmail: body.editorEmail?.trim(),
    projectKey,
    pagesCount,
    message,
    partIndex,
    partTotal,
  });

  return {
    issueKey: created.key,
    issueId: created.id,
    issueUrl,
    assigneeSet,
    notifyEmail,
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
    text: String(text || '').trim(),
  });
}

function jiraBrowseBase(env) {
  return (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');
}

function normalizeRemindJiraRef(env, jira) {
  const issueKey = String(jira?.issueKey || '').trim();
  if (!issueKey) return null;
  const issueUrl =
    String(jira?.issueUrl || '').trim() ||
    `${jiraBrowseBase(env)}/browse/${issueKey}`;
  return { issueKey, issueUrl };
}

/** Slack mrkdwn footer with Jira link (requires issue created first). */
function appendJiraTicketToSlackMessage(message, jira, env) {
  const base = String(message || '').trim();
  const ref = normalizeRemindJiraRef(env, jira);
  if (!ref) return base;
  if (base.includes(ref.issueUrl)) return base;
  const footer = `

📌 Jira task: ${ref.issueKey}
${ref.issueUrl}
When you're done reviewing, please comment on or close this task in Jira. 🙏`;
  const combined = `${base}${footer}`.trim();
  if (combined.length > 3900) {
    throw new Error('Message with Jira link is too long for Slack — send a smaller part');
  }
  return combined;
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
  const wantsJira = body.createJira === true;
  const existingJiraKey = String(body.jiraIssueKey || '').trim();
  let existingJiraUrl = String(body.jiraIssueUrl || '').trim();
  if (existingJiraKey && !existingJiraUrl) {
    existingJiraUrl = `${jiraBrowseBase(env)}/browse/${existingJiraKey}`;
  }
  const hasExistingJira = Boolean(existingJiraKey);

  const out = { ok: false, slack: null, jira: null };

  if (wantsJira) {
    try {
      const jira = await createRemindIssue(env, body);
      if (!jira?.issueKey || !jira?.issueUrl) {
        throw new Error('Jira issue was created but missing issue key or URL');
      }
      out.jira = { ok: true, ...jira };
    } catch (err) {
      out.jira = { ok: false, error: err?.message || 'Jira create failed' };
    }
  } else if (hasExistingJira) {
    out.jira = {
      ok: true,
      issueKey: existingJiraKey,
      issueUrl: existingJiraUrl,
      duplicate: true,
      linkedFromClient: true,
    };
  }

  if (wantsSlack) {
    if (!out.jira?.ok || !out.jira?.issueKey) {
      out.slack = {
        ok: false,
        error:
          out.jira?.error ||
          'Slack DM blocked — create the Jira task first, then send Slack DM.',
        skippedPendingJira: true,
      };
    } else {
      try {
        const slackText = appendJiraTicketToSlackMessage(body.message, out.jira, env);
        const slack = await sendSlackDirectMessage(env, {
          slackUserId,
          message: slackText,
          editor: (body.editor || '').trim(),
          editorEmail: body.editorEmail?.trim(),
        });
        out.slack = { ok: true, ...slack, jiraIssueKey: out.jira.issueKey };
      } catch (err) {
        out.slack = { ok: false, error: err?.message || 'Slack send failed' };
      }
    }
  }

  const slackOk =
    !wantsSlack ||
    Boolean(out.slack?.ok && out.slack?.ts && (out.slack?.verified || out.slack?.verifyNote));
  const jiraOk = !wantsJira || Boolean(out.jira?.ok);
  out.ok = slackOk && jiraOk;

  if ((wantsSlack || wantsJira) && !out.ok) {
    const parts = [];
    if (wantsJira && !jiraOk) parts.push(`Jira: ${out.jira?.error || 'create failed'}`);
    if (wantsSlack && !slackOk) parts.push(`Slack: ${out.slack?.error || 'DM not delivered'}`);
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

    if (request.method === 'POST' && url.pathname === '/v1/remind/lookup') {
      if (!authorize(request, env)) return unauthorized(request, env);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, request, env);
      }
      try {
        const result = await handleRemindLookup(env, body);
        return jsonResponse(result, result.ok ? 200 : 502, request, env);
      } catch (err) {
        return jsonResponse(
          { ok: false, error: err?.message || 'Jira lookup failed' },
          502,
          request,
          env,
        );
      }
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

/**
 * Shared helpers for scheduled remind follow-ups (GitHub Actions + local tests).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

export const REMIND_SENT_LABEL = 'catalog-remind-sent';
export const REMIND_TRACKING_PREFIX = 'catalog-remind-meta:';

export function followUpIntervalMinutesFromEnv(env = process.env) {
  const mins = Number(env.REMIND_FOLLOWUP_INTERVAL_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins;
  const days = Number(env.REMIND_FOLLOWUP_INTERVAL_DAYS);
  if (Number.isFinite(days) && days > 0) return days * 24 * 60;
  return 7 * 24 * 60;
}

export function followUpMaxCount(env = process.env) {
  const n = Number(env.REMIND_FOLLOWUP_MAX);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export function msSince(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}

export function parseRemindTrackingComments(comments) {
  const events = [];
  const list = comments?.comments || comments;
  if (!Array.isArray(list)) return events;
  for (const c of list) {
    const raw =
      typeof c.body === 'string'
        ? c.body
        : JSON.stringify(c.body || '');
    const idx = raw.indexOf(REMIND_TRACKING_PREFIX);
    if (idx < 0) continue;
    const jsonPart = raw.slice(idx + REMIND_TRACKING_PREFIX.length).trim();
    try {
      const parsed = JSON.parse(jsonPart.split('\n')[0]);
      if (parsed?.event) events.push({ ...parsed, commentId: c.id, created: c.created });
    } catch {
      /* ignore */
    }
  }
  return events;
}

export function summarizeRemindTracking(events) {
  const firstSlack = events.find((e) => e.event === 'first_slack');
  const followUps = events.filter((e) => e.event === 'follow_up');
  const lastFollowUp = followUps.length ? followUps[followUps.length - 1] : null;
  return {
    firstSlack,
    followUpCount: followUps.length,
    lastFollowUp,
    meta: firstSlack || null,
  };
}

export function isEligibleForFollowUp(tracking, { intervalMinutes, maxFollowUps, force = false }) {
  if (force) return { eligible: true, reason: 'forced' };
  if (!tracking.firstSlack) {
    return { eligible: false, reason: 'no_first_slack' };
  }
  if (tracking.followUpCount >= maxFollowUps) {
    return { eligible: false, reason: 'max_followups_reached' };
  }
  const refIso = tracking.lastFollowUp?.at || tracking.firstSlack.at;
  const intervalMs = intervalMinutes * 60 * 1000;
  if (msSince(refIso) < intervalMs) {
    return {
      eligible: false,
      reason: 'interval_not_elapsed',
      nextEligibleAt: new Date(Date.parse(refIso) + intervalMs).toISOString(),
    };
  }
  return { eligible: true, reason: 'due' };
}

export function extractPageUrlsFromIssue(issue) {
  const blob = JSON.stringify(issue.fields?.description || '');
  const urls = [...blob.matchAll(/https:\/\/lotusflare\.atlassian\.net\/wiki\/[^\s"\\]+/g)].map(
    (m) => m[0],
  );
  return [...new Set(urls)];
}

export function loadCatalog(catalogPath) {
  const path = catalogPath || join(root, 'public/data/catalog.json');
  if (!existsSync(path)) {
    throw new Error(`Catalog not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildCatalogUrlIndex(catalog) {
  const byUrl = new Map();
  for (const space of catalog.spaces || []) {
    for (const page of space.pages || []) {
      if (page.url) byUrl.set(page.url, page);
    }
  }
  return byUrl;
}

export function outdatedPageUrls(pageUrls, catalogIndex) {
  return pageUrls.filter((url) => {
    const page = catalogIndex.get(url);
    if (!page) return true;
    return page.recency === 'stale' || page.recency === 'legacy';
  });
}

export async function jiraFetch(env, path, init = {}) {
  const base = (env.JIRA_BASE_URL || 'https://lotusflare.atlassian.net').replace(/\/$/, '');
  const email = env.ATLASSIAN_EMAIL?.trim();
  const token = env.ATLASSIAN_API_TOKEN?.trim();
  if (!email || !token) {
    throw new Error('ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN are required');
  }
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
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
      data?.message ||
      `Jira HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function searchFollowUpCandidates(env, { projectKey = 'PROT', maxResults = 50 } = {}) {
  const jql = [
    `project = ${projectKey}`,
    `labels = "confluence-catalog"`,
    `labels = "${REMIND_SENT_LABEL}"`,
    'statusCategory != Done',
    'ORDER BY updated DESC',
  ].join(' AND ');
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields: 'summary,status,labels,description,assignee',
  });
  const data = await jiraFetch(env, `/rest/api/3/search?${params}`);
  return data?.issues || [];
}

export async function loadIssueTracking(env, issueKey) {
  const comments = await jiraFetch(
    env,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?maxResults=100`,
  );
  const events = parseRemindTrackingComments(comments);
  return summarizeRemindTracking(events);
}

export async function callWorkerFollowUp(
  { workerUrl, apiSecret },
  { jiraIssueKey, force = false, dryRun = false, intervalMinutes = null },
) {
  if (dryRun) {
    return { ok: true, dryRun: true, jiraIssueKey };
  }
  const base = String(workerUrl || '').replace(/\/$/, '');
  const secret = String(apiSecret || '').trim();
  if (!base || !secret) {
    throw new Error('VITE_REMIND_TRACK_URL and REMIND_API_SECRET are required');
  }
  const payload = {
    jiraIssueKey,
    force,
    sendSlack: true,
    sendJiraComment: true,
    sendEmail: true,
  };
  if (intervalMinutes != null) payload.intervalMinutes = intervalMinutes;

  const res = await fetch(`${base}/v1/remind/followup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.skipped) {
    throw new Error(data.error || `Follow-up HTTP ${res.status}`);
  }
  return data;
}

/**
 * Server-side remind dispatch (Slack DM + Jira) via Cloudflare Worker.
 * Build with VITE_REMIND_TRACK_URL and VITE_REMIND_API_KEY (GitHub Actions secrets).
 */

import { resolveSlackRecipient } from './slack.js';
import { guessEmail } from './contact.js';

export function isRemindTrackConfigured() {
  const url = import.meta.env.VITE_REMIND_TRACK_URL?.trim();
  const key = import.meta.env.VITE_REMIND_API_KEY?.trim();
  return Boolean(url && key);
}

/** True when Worker can DM this person (slack.json id or lotusflare email guess). */
export function canAutoSendSlack(contact, slackConfig) {
  if (!isRemindTrackConfigured()) return false;
  if (resolveSlackRecipient(contact, slackConfig)?.userId) return true;
  return Boolean(guessEmail(contact));
}

/** Strict: history-verified DM. */
export function slackRemindDelivered(slack) {
  return Boolean(slack?.ok && slack?.ts && slack?.verified);
}

/** Slack API accepted postMessage (ts) but history verify may be pending. */
export function slackRemindAccepted(slack) {
  return Boolean(slack?.ok && slack?.ts);
}

const JIRA_LOCK_PREFIX = 'lf-catalog-jira-lock:';

/** Stable key for “this remind part already has a Jira task” (sessionStorage). */
export function buildRemindJiraPartKey({ editor, partIndex, partTotal, pageIds = [] }) {
  const ids = [...pageIds].filter(Boolean).sort().join(',');
  return `${JIRA_LOCK_PREFIX}${editor}|${partTotal}|${partIndex}|${ids}`;
}

export function readRemindJiraPartLock(key) {
  if (typeof sessionStorage === 'undefined' || !key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.issueKey ? data : null;
  } catch {
    return null;
  }
}

export function writeRemindJiraPartLock(key, { issueKey, issueUrl, duplicate }) {
  if (typeof sessionStorage === 'undefined' || !key || !issueKey) return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        issueKey,
        issueUrl: issueUrl || '',
        duplicate: Boolean(duplicate),
        at: Date.now(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function rememberRemindJiraSuccess(key, jira) {
  if (!jira?.ok || !jira?.issueKey) return null;
  const entry = {
    issueKey: jira.issueKey,
    issueUrl: jira.issueUrl,
    duplicate: Boolean(jira.duplicate),
  };
  writeRemindJiraPartLock(key, entry);
  return entry;
}

export async function dispatchRemind({
  editor,
  editorEmail,
  message,
  pagesCount,
  partIndex,
  partTotal,
  remindTrackConfig,
  slackUserId,
  sendSlack = false,
  createJira = false,
  jiraIssueKey,
  jiraIssueUrl,
}) {
  const baseUrl = import.meta.env.VITE_REMIND_TRACK_URL?.trim().replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_REMIND_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return { skipped: true };
  }

  if (sendSlack && !String(jiraIssueKey || '').trim()) {
    return {
      ok: false,
      error: 'Create the Jira task first, then send Slack DM.',
    };
  }

  const catalogUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
      : '';

  const payload = {
    editor,
    editorEmail: editorEmail || undefined,
    message,
    pagesCount,
    partIndex,
    partTotal,
    catalogUrl,
    issueType: remindTrackConfig?.issueTypeName,
    labels: remindTrackConfig?.labels,
    sendSlack: Boolean(sendSlack),
    slackUserId: slackUserId || undefined,
    createJira: Boolean(createJira),
    jiraIssueKey: jiraIssueKey?.trim() || undefined,
    jiraIssueUrl: jiraIssueUrl?.trim() || undefined,
  };

  try {
    const res = await fetch(`${baseUrl}/v1/remind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const slackAccepted = !sendSlack || slackRemindAccepted(data.slack);
    const jiraCreateRequired = createJira;
    const jiraOk =
      !jiraCreateRequired || Boolean(data.jira?.ok && data.jira?.issueKey);
    const ok = (sendSlack ? slackAccepted : true) && jiraOk;
    return {
      ok,
      slack: data.slack ?? null,
      jira: data.jira ?? null,
      error:
        (sendSlack && !slackAccepted
          ? data.slack?.error || data.error || 'Slack DM not sent'
          : undefined) ||
        (jiraCreateRequired && data.jira && !jiraOk
          ? data.jira.error || 'Jira create failed'
          : undefined) ||
        (jiraCreateRequired && !data.jira?.ok ? data.jira?.error || data.error : undefined) ||
        (!slackAccepted || !jiraOk ? data.error : undefined) ||
        (!res.ok && slackAccepted && jiraOk ? `Remind service HTTP ${res.status}` : undefined) ||
        (!res.ok && !slackAccepted ? data.error || `Remind service HTTP ${res.status}` : undefined),
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Could not reach remind service',
    };
  }
}

/** @deprecated use dispatchRemind */
export async function trackRemindInJira(args) {
  const result = await dispatchRemind({ ...args, sendSlack: false, createJira: true });
  if (result.skipped) return { skipped: true };
  if (result.jira?.ok) {
    return { ok: true, ...result.jira };
  }
  return { ok: false, error: result.jira?.error || result.error || 'Jira failed' };
}

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
  createJira = true,
}) {
  const baseUrl = import.meta.env.VITE_REMIND_TRACK_URL?.trim().replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_REMIND_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return { skipped: true };
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
    createJira,
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
    const jiraOk = createJira === false || Boolean(data.jira?.ok);
    return {
      ok: slackAccepted && jiraOk,
      slack: data.slack ?? null,
      jira: data.jira ?? null,
      error:
        (sendSlack && !slackAccepted
          ? data.slack?.error || data.error || 'Slack DM not sent'
          : undefined) ||
        (createJira !== false && data.jira && !data.jira.ok ? data.jira.error : undefined) ||
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

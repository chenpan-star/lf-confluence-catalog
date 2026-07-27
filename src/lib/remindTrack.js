/**
 * Server-side remind dispatch (Slack DM + Jira) via Cloudflare Worker.
 * Build with VITE_REMIND_TRACK_URL and VITE_REMIND_API_KEY (GitHub Actions secrets).
 */

import { resolveSlackUserId } from './slack.js';

export function isRemindTrackConfigured() {
  const url = import.meta.env.VITE_REMIND_TRACK_URL?.trim();
  const key = import.meta.env.VITE_REMIND_API_KEY?.trim();
  return Boolean(url && key);
}

/** True when Worker can DM this person (needs slack.json user id map). */
export function canAutoSendSlack(contact, slackConfig) {
  if (!isRemindTrackConfigured()) return false;
  return Boolean(resolveSlackUserId(contact, slackConfig));
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
    sendSlack: Boolean(sendSlack && slackUserId),
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
    if (!res.ok && !data.slack && !data.jira) {
      return {
        ok: false,
        error: data.error || `Remind service failed (HTTP ${res.status})`,
      };
    }
    return {
      ok: Boolean(data.ok),
      slack: data.slack || null,
      jira: data.jira || null,
      error: data.error,
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

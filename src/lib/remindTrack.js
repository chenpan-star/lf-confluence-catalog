/**
 * Server-side Jira tracking when a reminder is sent (Cloudflare Worker).
 * Build with VITE_REMIND_TRACK_URL and VITE_REMIND_API_KEY (GitHub Actions secrets).
 */

export function isRemindTrackConfigured() {
  const url = import.meta.env.VITE_REMIND_TRACK_URL?.trim();
  const key = import.meta.env.VITE_REMIND_API_KEY?.trim();
  return Boolean(url && key);
}

export async function trackRemindInJira({
  editor,
  editorEmail,
  message,
  pagesCount,
  partIndex,
  partTotal,
  remindTrackConfig,
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
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `Tracking failed (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      issueKey: data.issueKey,
      issueUrl: data.issueUrl,
      assigneeSet: data.assigneeSet,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Could not reach remind tracking service',
    };
  }
}

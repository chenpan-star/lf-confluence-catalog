export const DOC_TYPE_LABELS = {
  general: 'General',
  'meeting-notes': 'Meeting Notes',
  onboarding: 'Onboarding / 101',
  'status-report': 'Status Report',
  incident: 'Incident / PIR',
  runbook: 'Runbook',
  faq: 'FAQ',
  architecture: 'Architecture',
  requirements: 'Requirements',
  testing: 'Testing / QA',
  api: 'API / Integration',
  deployment: 'Deployment',
  workshop: 'Workshop',
  template: 'Template / Draft',
  process: 'Process',
  tracker: 'Tracker / Hub',
  configuration: 'Configuration',
  glossary: 'Glossary',
};

export const RECENCY_LABELS = {
  active: 'Active (≤90d)',
  recent: 'Recent (91–365d)',
  stale: 'Stale (1–2y)',
  legacy: 'Legacy (>2y)',
  unknown: 'Unknown',
};

export const RECENCY_COLORS = {
  active: 'var(--green)',
  recent: 'var(--blue)',
  stale: 'var(--amber)',
  legacy: 'var(--muted)',
  unknown: 'var(--muted)',
};

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatNumber(n) {
  return n.toLocaleString();
}

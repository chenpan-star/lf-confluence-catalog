export const CATEGORIES = {
  'customer-projects': {
    label: 'Customer & Client Projects',
    description: 'Per-client delivery spaces (TMO, Globe, MTN, A1, etc.)',
    color: '#3b82f6',
  },
  'dno-platform': {
    label: 'DNO Platform Components',
    description: 'Shared product modules — Billing, Catalog, OE, Portal, etc.',
    color: '#8b5cf6',
  },
  'pmo-delivery': {
    label: 'PMO & Delivery Management',
    description: 'Program management and delivery coordination',
    color: '#06b6d4',
  },
  'company-hr': {
    label: 'Company, HR & Onboarding',
    description: 'Company-wide docs, hiring, internal frameworks',
    color: '#10b981',
  },
  engineering: {
    label: 'Engineering & Infrastructure',
    description: 'Platform engineering, infra, QA, tooling',
    color: '#f59e0b',
  },
  'support-ops': {
    label: 'Support, Ops & Incident',
    description: 'Customer support, incidents, production issues',
    color: '#ef4444',
  },
  regional: {
    label: 'Regional & Office Hubs',
    description: 'Regional office documentation',
    color: '#ec4899',
  },
  'partner-retired': {
    label: 'Partner / External / Retired',
    description: 'Archived, external-facing, or retired spaces',
    color: '#6b7280',
  },
  misc: {
    label: 'Templates, Tools & Misc',
    description: 'Uncategorized or niche spaces',
    color: '#94a3b8',
  },
};

export function spaceCategory(spaceName, spaceKey) {
  const name = (spaceName || '').toLowerCase();
  const key = (spaceKey || '').toLowerCase();
  if (key === 'archive' || key === 'glb2b' || name.includes('retired') || name.includes('[ext]')) {
    return 'partner-retired';
  }
  const client = [
    'globe', 't-mobile', 'tmo', 'mtn', 'digicel', 'dish', 'verizon', 'viasat', 'telus',
    'singtel', 'maxis', 'nomad', 'avantel', 'permat', 'indosat', 'emirates', 'a1', 'mwell',
    'mpic', 'petal', 'c spire', 'redo', 'mojo', 'ynow', 'waas', 'devedge', 'fiber',
    'api marketplace', 'mace', 'esim', 'gomo',
  ];
  if (client.some((p) => name.includes(p)) || ['g', 'globegomo', 'globeone', 'gp3', 'gcom'].includes(key)) {
    return 'customer-projects';
  }
  const dno = [
    'billing', 'charging', 'crm', 'catalog', 'portal', 'orchestration', 'order manager',
    'payment', 'rewards', 'promotions', 'pricing', 'inventory', 'user management', 'journey',
    'subscription', 'revenue', 'self care', 'experimentation', 'data platform',
    'engagement platform', 'cpq', 'monitoring', 'master document', 'polaris', 'party',
    'configurator', 'base objects', 'dpp', 'mfe', 'agreement', 'customer care', 'customer order',
  ];
  if (dno.some((p) => name.includes(p))) return 'dno-platform';
  if (name.includes('onboarding') || key === 'onboarding') return 'company-hr';
  if (name.includes('ai delivery') || key === 'aidr' || name.includes('pmo') || ['pmo', 'dm'].includes(key)) {
    return 'pmo-delivery';
  }
  const eng = [
    'engineering', 'infrastructure', 'platform team', 'quality assurance', 'webutil',
    'oncall', 'mobile development', 'sprint planning', 'kafka', 'redshift',
  ];
  if (eng.some((p) => name.includes(p)) || ['en', 'infra', 'pt', 'qa', 'webutil', 'oi', 'md', 'sp'].includes(key)) {
    return 'engineering';
  }
  const sup = ['support', 'customer success', 'incident', 'production issues', 'helpdesk', 'tooling and process'];
  if (sup.some((p) => name.includes(p)) || ['cskb', 'hds', 'cus', 'pir', 'incident', 'lfsup'].includes(key)) {
    return 'support-ops';
  }
  const reg = ['china', 'poland', 'serbia', 'singapore', 'indonesia', 'global offices'];
  if (reg.some((p) => name.includes(p)) || ['lc', 'lp', 'ls', 'lfs', 'li', 'gof'].includes(key)) {
    return 'regional';
  }
  const comp = [
    'lotusflare', 'interview', 'machine learning', 'solution architecture',
    'business strategy', 'growth', 'product analytics', 'resource management', 'lf product',
  ];
  if (comp.some((p) => name.includes(p)) || ['lot', 'iq', 'lml', 'sa', 'grow', 'pa', 'nm', 'lpr'].includes(key)) {
    return 'company-hr';
  }
  return 'misc';
}

export function docType(title, excerpt = '') {
  const t = `${title} ${excerpt}`.toLowerCase();
  const rules = [
    ['onboarding', /\b(onboarding|101|getting started|welcome aboard|new joiner)\b/],
    ['meeting-notes', /\b(meeting notes|standup|retro|steerco|biweekly)\b|\d{4}-\d{2}-\d{2}/],
    ['status-report', /\b(status report|weekly summary|weekly report|release note)\b/],
    ['incident', /\b(incident|pir\b|postmortem|outage|production issue)\b/],
    ['runbook', /\b(runbook|playbook|troubleshoot|troubleshooting)\b/],
    ['faq', /\b(faq|frequently asked|q\s*&\s*a)\b/],
    ['architecture', /\b(architecture|design doc|system design|hld|lld)\b/],
    ['requirements', /\b(requirement|specification|spec\b|user story|acceptance criteria|prd\b)\b/],
    ['testing', /\b(test plan|test case|testing|qa\b|e2e|performance test|uat\b)\b/],
    ['api', /\b(api\b|integration|endpoint|swagger|openapi)\b/],
    ['deployment', /\b(deploy|deployment|release|go.?live|rollout|migration)\b/],
    ['workshop', /\b(workshop|training|curriculum|tutorial)\b/],
    ['template', /\b(template|draft\b|xxxx|tbd\b|placeholder)\b/],
    ['process', /\b(process|workflow|procedure|sop\b|guideline|policy)\b/],
    ['tracker', /\b(tracker|hub\b|dashboard|backlog)\b/],
    ['configuration', /\b(config|configuration|setup|environment)\b/],
    ['glossary', /\b(glossary)\b/],
  ];
  for (const [label, pat] of rules) {
    if (pat.test(t)) return label;
  }
  return 'general';
}

export function recency(lastModified) {
  if (!lastModified) return 'unknown';
  const days = (Date.now() - new Date(lastModified).getTime()) / 86400000;
  if (days <= 90) return 'active';
  if (days <= 365) return 'recent';
  if (days <= 730) return 'stale';
  return 'legacy';
}

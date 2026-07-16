/** Extended category copy for category landing pages (supplements catalog.categories). */
export const CATEGORY_INTRO = {
  'customer-projects': {
    summary:
      'Customer & Client Projects is where delivery teams document active operator and enterprise engagements — from integration playbooks and cutover runbooks to account-specific architecture, test plans, and handover notes.',
    whoItsFor:
      'Customer engineers, solution architects, delivery managers, and client-facing teams who need account-scoped documentation tied to a specific operator or client.',
    whatYouFind:
      'Per-client Confluence spaces with implementation guides, environment notes, release checklists, meeting notes, and historical decisions for live deployments.',
    examples: 'T-Mobile, Globe, MTN, A1, Digicel, and other operator or enterprise accounts.',
    tips: 'Use the left panel to pick a client space, then filter by last editor to see who owns outdated pages in that account.',
  },
  'dno-platform': {
    summary:
      'DNO Platform Components covers shared product modules that power multiple customers — the canonical home for billing, catalog, orchestration, portal, promotions, and cross-cutting platform behavior.',
    whoItsFor:
      'Product managers, platform engineers, and module owners documenting features, APIs, configuration, and release behavior that applies across tenants.',
    whatYouFind:
      'Functional specs, technical designs, user guides, API notes, release roadmaps, and module-level runbooks for core DNO capabilities.',
    examples: 'Billing Manager, Product Catalog, Order Engine, Portal, Promotions, Resource Management.',
    tips: 'Stale pages here often affect many customers — prioritize review when freshness shows Stale or Legacy.',
  },
  engineering: {
    summary:
      'Engineering & Infrastructure spans platform engineering, cloud and service infrastructure, QA, developer tooling, and the technical standards that keep LotusFlare buildable and operable at scale.',
    whoItsFor:
      'Backend and infra engineers, SREs, QA leads, and developers looking for architecture decisions, pipelines, monitoring, and engineering playbooks.',
    whatYouFind:
      'Architecture docs, CI/CD guides, infra runbooks, testing strategy, on-call notes, and internal tooling documentation.',
    examples: 'Kubernetes, observability, deployment pipelines, test automation, and shared libraries.',
    tips: 'Pair this category with Filter by name on the space page to audit docs owned by a specific engineer.',
  },
  'support-ops': {
    summary:
      'Support, Ops & Incident is the operational layer — production issues, customer escalations, incident timelines, post-incident reviews, and the runbooks teams rely on during outages.',
    whoItsFor:
      'Support engineers, on-call responders, ops leads, and anyone triaging production or customer-impacting events.',
    whatYouFind:
      'Incident reports (PIRs), escalation paths, troubleshooting guides, production checklists, and support knowledge bases.',
    examples: 'PIRs, war-room notes, escalation matrices, and production support procedures.',
    tips: 'Check Need review counts — outdated incident or runbook pages are high-risk during the next outage.',
  },
  'company-hr': {
    summary:
      'Company, HR & Onboarding holds company-wide internal knowledge — people operations, hiring, onboarding paths, policies, and frameworks that apply to all employees.',
    whoItsFor:
      'All employees, people ops, recruiters, and managers onboarding new hires or looking up internal process.',
    whatYouFind:
      'Onboarding 101s, HR policies, internal how-tos, org frameworks, and company-wide reference material.',
    examples: 'New hire guides, benefits, internal tools, and cross-team process documentation.',
    tips: 'Onboarding pages should stay current — filter by Outdated freshness when reviewing this category.',
  },
  'pmo-delivery': {
    summary:
      'PMO & Delivery Management tracks program execution — release coordination, delivery checklists, cross-team planning, and the artifacts that keep large programs visible and on schedule.',
    whoItsFor:
      'Program managers, delivery leads, release managers, and teams coordinating multi-squad work.',
    whatYouFind:
      'Release plans, delivery checklists, sprint or PI planning, status templates, and program tracking hubs.',
    examples: 'Release calendars, PMO templates, delivery retros, and cross-project status pages.',
    tips: 'Use Send reminders from the page detail panel to nudge owners of stale planning docs before a milestone.',
  },
  regional: {
    summary:
      'Regional & Office Hubs documents location-specific knowledge for distributed offices — local process, regional operations, and hub-specific reference material.',
    whoItsFor:
      'Regional leads and distributed teams who maintain docs scoped to a geography or office rather than a global product line.',
    whatYouFind:
      'Regional playbooks, local compliance notes, office-specific procedures, and hub onboarding material.',
    examples: 'APAC, EMEA, and other regional office documentation.',
    tips: 'Spaces here are often smaller — browse the left panel list and sort by outdated count if available.',
  },
  'partner-retired': {
    summary:
      'Partner / External / Retired is the archive — partner-facing content, retired products, legacy projects, and spaces kept for historical reference but not actively maintained.',
    whoItsFor:
      'Teams needing historical context, audit trails, or legacy integration details — not primary day-to-day documentation.',
    whatYouFind:
      'Retired product docs, old partner portals, deprecated modules, and archived project spaces.',
    examples: 'Legacy v3 modules, retired client projects, and external partner documentation.',
    tips: 'High stale counts are expected — confirm whether a page should be archived in Confluence or deleted.',
  },
  misc: {
    summary:
      'Templates, Tools & Misc collects sandboxes, experiments, draft templates, and niche spaces that do not map cleanly to a product, customer, or function.',
    whoItsFor:
      'Anyone with personal drafts, team experiments, or utility spaces that have not been categorized yet.',
    whatYouFind:
      'Draft templates, personal notes, tool experiments, and uncategorized or one-off documentation.',
    examples: 'Template libraries, scratch spaces, and small utility wikis.',
    tips: 'Good candidates for cleanup — consider re-homing important pages into a proper category space.',
  },
};

/** Short blurb for category cards on the home / all-categories pages. */
export function getCategoryCardDescription(categoryId, fallback = '') {
  const intro = CATEGORY_INTRO[categoryId];
  return intro?.summary || fallback;
}

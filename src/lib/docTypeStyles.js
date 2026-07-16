/** Accent hues for document-type filter pills (used as CSS class suffix). */
export const DOC_TYPE_PILL_CLASS = {
  general: 'doc-type-general',
  'meeting-notes': 'doc-type-meeting-notes',
  onboarding: 'doc-type-onboarding',
  'status-report': 'doc-type-status-report',
  incident: 'doc-type-incident',
  runbook: 'doc-type-runbook',
  faq: 'doc-type-faq',
  architecture: 'doc-type-architecture',
  requirements: 'doc-type-requirements',
  testing: 'doc-type-testing',
  api: 'doc-type-api',
  deployment: 'doc-type-deployment',
  workshop: 'doc-type-workshop',
  template: 'doc-type-template',
  process: 'doc-type-process',
  tracker: 'doc-type-tracker',
  configuration: 'doc-type-configuration',
  glossary: 'doc-type-glossary',
};

export function docTypePillClass(docTypeId) {
  return DOC_TYPE_PILL_CLASS[docTypeId] || 'doc-type-general';
}

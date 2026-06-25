import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { inferDepartmentFromEditors } from './zoho-match.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../config/departments.json');

let cachedConfig = null;

export function loadDepartmentConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return cachedConfig;
}

export const DEPARTMENT_ORDER = [
  'server-engineering',
  'client-engineering',
  'infrastructure-engineering',
  'product-management-data-science',
  'hr-recruiting',
  'marketing',
  'operations-delivery',
  'sales',
  'finance-operations',
  'needs-owner',
];

const INFRA_KEYS = new Set([
  'EN', 'INFRA', 'PT', 'QA', 'KAFKA', 'RED', 'OI', 'WEBUTIL', 'MD', 'SP', 'ODY',
]);

const OPS_KEYS = new Set([
  'PMO', 'DM', 'AIDR', 'CSKB', 'HDS', 'CUS', 'INCIDENT', 'PIR', 'LFSUP',
]);

const HR_KEYS = new Set(['Onboarding', 'IQ', 'LOT', 'NM', 'LML']);

const PRODUCT_KEYS = new Set(['PA', 'LPR', 'CDP', 'EP', 'SA']);

const FINANCE_KEYS = new Set(['GO']);

const MARKETING_KEYS = new Set(['GROW']);

/** Heuristic department when no explicit override exists. */
export function inferDepartment(spaceKey, spaceName, category) {
  const key = spaceKey || '';
  const name = (spaceName || '').toLowerCase();

  if (INFRA_KEYS.has(key)) return 'infrastructure-engineering';
  if (OPS_KEYS.has(key)) return 'operations-delivery';
  if (HR_KEYS.has(key)) return 'hr-recruiting';
  if (PRODUCT_KEYS.has(key)) return 'product-management-data-science';
  if (FINANCE_KEYS.has(key)) return 'finance-operations';
  if (MARKETING_KEYS.has(key)) return 'marketing';

  if (category === 'dno-platform') return 'server-engineering';
  if (category === 'customer-projects') return 'client-engineering';
  if (category === 'engineering') return 'infrastructure-engineering';
  if (category === 'support-ops') return 'operations-delivery';
  if (category === 'pmo-delivery') return 'operations-delivery';
  if (category === 'company-hr') return 'hr-recruiting';

  if (category === 'regional') return 'operations-delivery';
  if (category === 'partner-retired') return 'operations-delivery';

  if (name.includes('marketing') || name.includes('growth')) return 'marketing';
  if (name.includes('sales')) return 'sales';
  if (name.includes('finance') || name.includes('business strategy')) return 'finance-operations';

  return 'needs-owner';
}

export function resolveSpaceDepartment(spaceKey, spaceName, category, context = {}) {
  const config = loadDepartmentConfig();
  const overrides = config.spaceOverrides || {};
  const key = spaceKey || spaceName;
  if (overrides[key]) {
    return { departmentId: overrides[key], source: 'manual' };
  }

  const { employeeIndex, pages } = context;
  if (employeeIndex && pages?.length) {
    const zoho = inferDepartmentFromEditors(pages, employeeIndex);
    if (zoho?.departmentId) {
      return { departmentId: zoho.departmentId, source: 'zoho', zoho };
    }
  }

  return {
    departmentId: inferDepartment(spaceKey, spaceName, category),
    source: 'heuristic',
  };
}

export function getDepartmentDefinitions() {
  const config = loadDepartmentConfig();
  return config.departments;
}

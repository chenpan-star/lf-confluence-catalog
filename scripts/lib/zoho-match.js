/**
 * Map Zoho People department names → catalog department IDs.
 * Edit when Zoho org names differ slightly.
 */
export const ZOHO_DEPARTMENT_MAP = {
  'Server Engineering': 'server-engineering',
  'Client Engineering': 'client-engineering',
  'Infrastructure Engineering': 'infrastructure-engineering',
  'Product Management and Data Scientist': 'product-management-data-science',
  'HR/Recruiting': 'hr-recruiting',
  'HR / Recruiting': 'hr-recruiting',
  'Marketing': 'marketing',
  'Operations and Delivery': 'operations-delivery',
  'Sales': 'sales',
  'Finance and Operations': 'finance-operations',
};

export function zohoDepartmentToCatalog(zohoDept) {
  if (!zohoDept) return null;
  const trimmed = zohoDept.trim();
  if (ZOHO_DEPARTMENT_MAP[trimmed]) return ZOHO_DEPARTMENT_MAP[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [key, id] of Object.entries(ZOHO_DEPARTMENT_MAP)) {
    if (key.toLowerCase() === lower) return id;
  }

  if (lower.includes('server') && lower.includes('engineer')) return 'server-engineering';
  if (lower.includes('client') && lower.includes('engineer')) return 'client-engineering';
  if (lower.includes('infrastructure')) return 'infrastructure-engineering';
  if (lower.includes('product') || lower.includes('data scientist')) {
    return 'product-management-data-science';
  }
  if (lower.includes('hr') || lower.includes('recruit')) return 'hr-recruiting';
  if (lower.includes('marketing')) return 'marketing';
  if (lower.includes('operations') && lower.includes('delivery')) return 'operations-delivery';
  if (lower.includes('sales')) return 'sales';
  if (lower.includes('finance')) return 'finance-operations';

  return null;
}

export function normalizePersonName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s+\d+$/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build lookup indexes from Zoho employee list. */
export function buildEmployeeIndex(employees) {
  const byEmail = new Map();
  const byName = new Map();

  for (const emp of employees) {
    if (emp.status && emp.status !== 'Active') continue;
    if (emp.email) byEmail.set(emp.email.toLowerCase(), emp);
    const name = normalizePersonName(emp.displayName);
    if (name) {
      if (!byName.has(name)) byName.set(name, emp);
      const reversed = normalizePersonName(`${emp.lastName} ${emp.firstName}`);
      if (reversed && !byName.has(reversed)) byName.set(reversed, emp);
    }
  }

  return { byEmail, byName };
}

export function matchEmployee(nameOrEmail, index) {
  if (!nameOrEmail || !index) return null;
  const raw = String(nameOrEmail).trim();
  if (raw.includes('@')) {
    return index.byEmail.get(raw.toLowerCase()) || null;
  }
  return index.byName.get(normalizePersonName(raw)) || null;
}

/**
 * Infer catalog department for a space from page editor/creator activity.
 * Returns { departmentId, confidence, topContributors } or null.
 */
export function inferDepartmentFromEditors(pages, employeeIndex) {
  const votes = new Map();
  const contributors = new Map();

  for (const page of pages) {
    for (const person of [page.lastEditor, page.creator]) {
      if (!person) continue;
      const emp = matchEmployee(person, employeeIndex);
      if (!emp?.department) continue;
      const deptId = zohoDepartmentToCatalog(emp.department);
      if (!deptId) continue;
      votes.set(deptId, (votes.get(deptId) || 0) + 1);
      const key = emp.displayName || person;
      contributors.set(key, (contributors.get(key) || 0) + 1);
    }
  }

  if (!votes.size) return null;

  let bestId = null;
  let bestCount = 0;
  for (const [id, count] of votes) {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }

  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  const topContributors = [...contributors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, edits]) => ({ name, edits }));

  return {
    departmentId: bestId,
    confidence: total ? Math.round((bestCount / total) * 100) : 0,
    topContributors,
    voteBreakdown: Object.fromEntries(votes),
  };
}

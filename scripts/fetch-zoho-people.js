/**
 * Zoho People API client — fetch active employees.
 * Requires: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './load-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../data/zoho-employees.json');

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function hasZohoCredentials() {
  return Boolean(env('ZOHO_CLIENT_ID') && env('ZOHO_CLIENT_SECRET') && env('ZOHO_REFRESH_TOKEN'));
}

async function getAccessToken() {
  const accountsUrl = env('ZOHO_ACCOUNTS_URL', 'https://accounts.zoho.com');
  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env('ZOHO_CLIENT_ID'),
      client_secret: env('ZOHO_CLIENT_SECRET'),
      refresh_token: env('ZOHO_REFRESH_TOKEN'),
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Zoho token error ${res.status}`);
  }
  return data.access_token;
}

/** Flatten Zoho getRecords nested result into employee objects. */
export function parseEmployeeRecords(apiResponse) {
  const result = apiResponse?.response?.result;
  if (!result || !Array.isArray(result)) return [];

  const employees = [];
  for (const chunk of result) {
    if (!chunk || typeof chunk !== 'object') continue;
    for (const rows of Object.values(chunk)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          employees.push(normalizeEmployee(row));
        }
      }
    }
  }
  return employees;
}

function normalizeEmployee(row) {
  const first = row.FirstName || '';
  const last = row.LastName || '';
  const email = (row.EmailID || row.Employeemailalias || '').toLowerCase();
  const department = row.Department || '';
  const status = row.Employeestatus || '';

  return {
    id: String(row.EmployeeID || row.Zoho_ID || ''),
    firstName: first,
    lastName: last,
    displayName: [first, last].filter(Boolean).join(' ').trim(),
    email,
    department,
    designation: row.Designation || '',
    status,
    reportingTo: row['Reporting_To.MailID'] || row.Reporting_To || '',
    location: row.LocationName || row.Work_location || '',
  };
}

async function fetchEmployeePage(accessToken, sIndex, limit = 200) {
  const peopleUrl = env('ZOHO_PEOPLE_URL', 'https://people.zoho.com');
  const params = new URLSearchParams({
    sIndex: String(sIndex),
    limit: String(limit),
    searchParams: JSON.stringify({
      searchField: 'Employeestatus',
      searchOperator: 'Is',
      searchText: 'Active',
    }),
  });

  const url = `${peopleUrl}/people/api/forms/employee/getRecords?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho People API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

export async function fetchAllEmployees({ onProgress } = {}) {
  const accessToken = await getAccessToken();
  const all = [];
  let sIndex = 1;
  const limit = 200;
  let batch = 0;

  while (true) {
    batch += 1;
    const data = await fetchEmployeePage(accessToken, sIndex, limit);
    const page = parseEmployeeRecords(data);
    if (!page.length) break;
    all.push(...page);
    if (onProgress) onProgress({ batch, fetched: all.length, pageSize: page.length });
    if (page.length < limit) break;
    sIndex += limit;
  }

  return all;
}

export function loadCachedEmployees(path = OUTPUT) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function fetchAndSaveEmployees({ onProgress } = {}) {
  const employees = await fetchAllEmployees({ onProgress });
  const payload = {
    fetchedAt: new Date().toISOString(),
    count: employees.length,
    employees,
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(payload));
  return payload;
}

async function main() {
  if (!hasZohoCredentials()) {
    console.error('Missing Zoho credentials in .env');
    process.exit(1);
  }
  console.log('Fetching Zoho People employees…');
  const payload = await fetchAndSaveEmployees({
    onProgress: ({ batch, fetched }) => {
      process.stdout.write(`\r  Batch ${batch}: ${fetched} employees`);
    },
  });
  console.log(`\nWrote ${OUTPUT} — ${payload.count} active employees`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv();
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

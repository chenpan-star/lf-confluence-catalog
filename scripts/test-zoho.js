/**
 * Test Zoho People API using refresh token from .env
 */
import { loadEnv } from './load-env.js';
import { parseEmployeeRecords } from './fetch-zoho-people.js';

loadEnv();

const ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const PEOPLE_URL = process.env.ZOHO_PEOPLE_URL || 'https://people.zoho.com';
const clientId = process.env.ZOHO_CLIENT_ID?.trim();
const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();

if (!clientId || !clientSecret || !refreshToken) {
  console.error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN in .env');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || JSON.stringify(data));
  }
  return data.access_token;
}

async function main() {
  console.log('Refreshing Zoho access token…');
  const token = await getAccessToken();
  console.log('✓ Access token OK\n');

  const url = `${PEOPLE_URL}/people/api/forms/employee/getRecords?sIndex=1&limit=5`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`People API ${res.status}:`, text.slice(0, 500));
    process.exit(1);
  }

  const data = JSON.parse(text);
  const employees = parseEmployeeRecords(data);
  console.log(`✓ Parsed ${employees.length} employee record(s)\n`);
  for (const emp of employees.slice(0, 5)) {
    console.log(`  · ${emp.displayName} | ${emp.department || '(no dept)'} | ${emp.email}`);
  }
  console.log('\nZoho People connection is working.');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});

/**
 * Upload public/onboarding/*.png to a Confluence page as attachments.
 * Credentials from .env (ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, ATLASSIAN_SITE).
 * Usage: node scripts/upload-onboarding-screenshots.mjs [pageId]
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pageId = process.argv[2] || '7479820289';
const shotDir = join(root, 'public/onboarding');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const email = process.env.ATLASSIAN_EMAIL;
const token = process.env.ATLASSIAN_API_TOKEN;
const site = process.env.ATLASSIAN_SITE || 'lotusflare.atlassian.net';

if (!email || !token) {
  console.error('Missing ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');
const base = `https://${site}/wiki/rest/api/content/${pageId}/child/attachment`;

const files = readdirSync(shotDir)
  .filter((f) => f.endsWith('.png'))
  .sort();

const uploaded = [];

for (const file of files) {
  const bytes = readFileSync(join(shotDir, file));
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), file);

  // Prefer update-if-exists for re-runs
  let res = await fetch(`${base}?allowDuplicated=true`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'X-Atlassian-Token': 'nocheck',
      Accept: 'application/json',
    },
    body: form,
  });

  if (!res.ok) {
    // Fallback: create
    const form2 = new FormData();
    form2.append('file', new Blob([bytes], { type: 'image/png' }), file);
    res = await fetch(base, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'X-Atlassian-Token': 'nocheck',
        Accept: 'application/json',
      },
      body: form2,
    });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed ${file}: ${res.status} ${text.slice(0, 400)}`);
    process.exit(1);
  }

  const json = JSON.parse(text);
  const att = json.results?.[0] || json;
  const fileId = att.extensions?.fileId || att.fileId;
  uploaded.push({
    file,
    attachmentId: String(att.id),
    mediaId: fileId,
    title: att.title,
    downloadLink: att._links?.download,
  });
  console.error(`Uploaded ${file} → attachment ${att.id} media ${fileId}`);
}

console.log(JSON.stringify({ pageId, uploaded }, null, 2));

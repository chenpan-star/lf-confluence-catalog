/**
 * One-time Zoho OAuth setup — captures the auth code on localhost and prints refresh token.
 *
 * 1. Add to .env (or export in shell):
 *      ZOHO_CLIENT_ID=...
 *      ZOHO_CLIENT_SECRET=...
 * 2. Run: npm run zoho:auth
 * 3. Open the printed URL in your browser → Accept
 * 4. Copy refresh_token into .env as ZOHO_REFRESH_TOKEN
 *
 * Redirect URI in Zoho API Console must be exactly:
 *   http://localhost:8080/oauth/callback
 */
import http from 'http';
import { loadEnv } from './load-env.js';

loadEnv();

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const SCOPES = 'ZOHOPEOPLE.forms.READ,ZOHOPEOPLE.employee.READ';

const clientId = process.env.ZOHO_CLIENT_ID?.trim();
const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error('Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET in .env');
  process.exit(1);
}

const authUrl =
  `${ACCOUNTS_URL}/oauth/v2/auth?` +
  new URLSearchParams({
    scope: SCOPES,
    client_id: clientId,
    response_type: 'code',
    access_type: 'offline',
    redirect_uri: REDIRECT_URI,
    prompt: 'consent',
  });

async function exchangeCode(code) {
  const res = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Token response not JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || text);
  }
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/oauth/callback') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Waiting for /oauth/callback');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Zoho error</h1><p>${error}</p>`);
    console.error('Zoho returned error:', error);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Missing code</h1><p>No authorization code in URL.</p>');
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h1>Zoho connected</h1>
        <p>Refresh token printed in your terminal. You can close this tab.</p>
      </body></html>
    `);

    console.log('\n✓ Token exchange successful\n');
    if (tokens.refresh_token) {
      console.log('Add this to your .env file:\n');
      console.log(`ZOHO_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log('No refresh_token in response (may already exist). Response:');
      console.log(JSON.stringify(tokens, null, 2));
    }
    console.log('\nAlso add if missing:');
    console.log(`ZOHO_ACCOUNTS_URL=${ACCOUNTS_URL}`);
    console.log('ZOHO_PEOPLE_URL=https://people.zoho.com');
    console.log('\nTest with: npm run zoho:test\n');

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><pre>${err.message}</pre>`);
    console.error('Exchange failed:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log('=== Zoho OAuth setup ===\n');
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Click Accept / Allow');
  console.log('3. Browser will redirect here — this script captures the code automatically\n');
});

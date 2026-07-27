# LF Confluence Catalog

A read-only static site to browse LotusFlare Confluence spaces grouped by category, document type, and freshness. Data refreshes on a **daily schedule** from the Confluence API.

## Features

- 9 space categories, 130+ spaces, 25,000+ pages
- Per-page: title, link, last modified, creator, last editor
- Search and filters by document type and recency
- **Scheduled refresh** — daily fetch from Confluence → rebuild catalog

## Quick start (browse only)

```bash
cd ~/Projects/lf-confluence-catalog
npm install
npm run dev
```

Open http://localhost:5173

## Scheduled refresh setup

### 1. Create an API token

1. Go to [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Create a token
3. Copy `.env.example` → `.env` and fill in:

```bash
cp .env.example .env
```

```env
ATLASSIAN_EMAIL=you@lotusflare.com
ATLASSIAN_API_TOKEN=your_token
ATLASSIAN_SITE=lotusflare.atlassian.net
```

### 2. Test credentials

```bash
npm run test:auth
```

If you see **403 "not permitted to use Confluence"**, your account lacks a Confluence API license seat — ask IT/admin or verify `.env` email matches your Confluence login.

### 3. Run a manual refresh

```bash
npm run refresh
```

Use cached data without calling the API:

```bash
npm run refresh:offline
```

This will:
1. Fetch all non-personal pages from Confluence (~2–5 min)
2. Write `data/raw-pages.json` (gitignored)
3. Regenerate `public/data/catalog.json`

### 3. Schedule locally (cron)

```bash
crontab -e
```

Add (daily at 6:00 AM):

```cron
0 6 * * * cd /Users/panchen/Projects/lf-confluence-catalog && /usr/local/bin/npm run refresh >> /tmp/confluence-refresh.log 2>&1
```

Adjust the `npm` path (`which npm`).

### 4. Deploy for your team (GitHub Pages)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions.

Summary:
1. Push repo to GitHub
2. Settings → **Pages** → Source: **GitHub Actions**
3. Share `https://<you>.github.io/lf-confluence-catalog/`

Optional: add `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN` secrets for daily catalog refresh via Actions.

### Slack reminders

**Send reminder** copies a message and opens Slack so you can paste it into the last editor’s DM.  
Optional: map Slack member IDs in `public/config/slack.json` (monthly Action — see [DEPLOY.md](./DEPLOY.md)).

### Simple password (no IT)

1. Pick a team password and add GitHub **repository secret** `SITE_ACCESS_PASSWORD` (plain password).
2. Push / deploy — visitors see a password screen before the catalog.
3. Local dev: `npm run access:hash -- your-password` → add `VITE_ACCESS_PASSWORD_HASH=...` to `.env`.

Note: `catalog.json` is still a public static file for technical users; this blocks normal browsing only.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run fetch` | Fetch pages from Confluence only |
| `npm run generate` | Build catalog.json from `data/raw-pages.json` |
| `npm run refresh` | Fetch + generate (full pipeline) |
| `npm run build` | Production build → `dist/` |
| `npm run slack:export-users` | Export Slack user IDs into `slack.json` |

## Data flow

```
Confluence API  →  data/raw-pages.json  →  public/data/catalog.json  →  static site
     ↑ daily cron / GitHub Actions
```

## Notes

- Personal spaces (`~username`) are excluded
- Site is static at runtime — no Confluence login needed to browse
- Creator/editor fields come from the API at refresh time
- Without `.env` credentials, `npm run refresh` reuses existing `data/raw-pages.json` if present

# Deploy to GitHub Pages

## One-time setup

### 1. Create the GitHub repo

1. Open https://github.com/new
2. Repository name: `lf-confluence-catalog` (or pick another name — see note below)
3. **Private** or **Public** (team must have repo access if private)
4. Do **not** add README / .gitignore (we already have them)
5. Create repository

### 2. Push this project

```bash
cd ~/Projects/lf-confluence-catalog

git add .
git commit -m "Initial commit: LF Confluence catalog with GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR_ORG_OR_USER/lf-confluence-catalog.git
git push -u origin main
```

Replace `YOUR_ORG_OR_USER` with your GitHub username or org.

### 3. Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. After the first push, open **Actions** tab — wait for **Deploy to GitHub Pages** to finish (green)

### 4. Open the site

```
https://YOUR_ORG_OR_USER.github.io/lf-confluence-catalog/
```

Share that URL with your team.

---

## Custom domain (for Okta / Cloudflare Access)

Use a LotusFlare hostname so IT can put **Cloudflare Access + Okta** in front of the site.  
Default hostname for IT: **`confluence-catalog.lotusflare.com`** (add `public/CNAME` when DNS is ready).

> **Important:** Only enable the custom domain in GitHub **after** IT confirms DNS resolves.  
> If you enable it too early, `github.io` will redirect to a dead hostname and the site becomes unreachable.

### 1. DNS (ask IT / Infra)

Create a **CNAME** record:

| Type | Name | Target |
|------|------|--------|
| CNAME | `confluence-catalog` (or your chosen host) | `chenpan-star.github.io` |

If you use a different hostname, edit `public/CNAME` to match exactly (one line, no `https://`).

### 2. GitHub Pages settings

1. Repo → **Settings** → **Pages**
2. Under **Custom domain**, enter the same hostname as `public/CNAME`  
   (e.g. `confluence-catalog.lotusflare.com`) → **Save**
3. Wait for DNS check (can take up to 24h; often minutes)
4. Enable **Enforce HTTPS** once the certificate is ready

The `public/CNAME` file (when present) is copied into `dist/` on each deploy so GitHub keeps the domain configured.  
Create `public/CNAME` with one line — the hostname only — when DNS is live.

### 3. Actions variable (required for custom domain)

Project sites on `github.io` use base path `/lf-confluence-catalog/`.  
A custom domain serves the site at the **domain root**, so assets must use `/`.

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. **New repository variable**
   - Name: `VITE_BASE_PATH`
   - Value: `/`
3. Re-run **Deploy to GitHub Pages** (or push a commit)

Until this variable is set, the custom domain may load but CSS/JS routes can 404.

### 4. Verify

```bash
curl -sI https://confluence-catalog.lotusflare.com/ | head -3
curl -sI https://confluence-catalog.lotusflare.com/data/catalog.json | head -3
```

Open the site in a browser and check category navigation works.

### 5. Restrict access to LotusFlare employees (Okta + Cloudflare)

GitHub Pages **cannot** enforce login by itself. The `github.io` URL is public to anyone with the link.  
To allow **only LotusFlare staff**, IT puts **Cloudflare Access** in front of a **LotusFlare custom domain** with **Okta** as the identity provider.

```mermaid
flowchart LR
  User --> CF[Cloudflare Access]
  CF -->|Okta login| Okta[Okta]
  CF -->|@lotusflare.com allowed| GH[GitHub Pages origin]
```

#### What you need from IT (copy this ticket)

**Subject:** Cloudflare Access + Okta for `confluence-catalog.lotusflare.com`

**Request:**

1. **DNS** (Cloudflare-proxied CNAME):
   - Name: `confluence-catalog.lotusflare.com`
   - Target: `chenpan-star.github.io`
   - Proxy: **ON** (orange cloud) — required for Access

2. **Cloudflare Zero Trust → Access → Application**
   - Type: Self-hosted
   - Domain: `confluence-catalog.lotusflare.com`
   - Session: 24h (or company default)

3. **Access policy**
   - Allow: emails ending in `@lotusflare.com` **OR** Okta group (e.g. all employees)
   - Deny: everyone else

4. **Identity provider:** Okta (SAML or OIDC — use existing LotusFlare Okta ↔ Cloudflare integration if present)

5. **Confirm** when DNS resolves:
   ```bash
   dig +short confluence-catalog.lotusflare.com
   ```

**Context:** Static internal Confluence catalog on GitHub Pages; contains page titles/URLs/metadata. Origin repo: `chenpan-star/lf-confluence-catalog`.

#### After IT confirms DNS + Access

Do these in order:

| Step | Action |
|------|--------|
| 1 | IT confirms `dig confluence-catalog.lotusflare.com` returns Cloudflare IPs |
| 2 | Create `public/CNAME` with one line: `confluence-catalog.lotusflare.com` |
| 3 | Commit + push → wait for deploy |
| 4 | GitHub → **Settings → Pages** → Custom domain → `confluence-catalog.lotusflare.com` |
| 5 | **Repository variable** `VITE_BASE_PATH` = `/` |
| 6 | Re-run **Deploy to GitHub Pages** |
| 7 | Open `https://confluence-catalog.lotusflare.com` → should redirect to **Okta login** |
| 8 | Share **only** the custom domain URL internally (not `github.io`) |

#### Important limitations

| URL | Protected? |
|-----|------------|
| `https://confluence-catalog.lotusflare.com` | **Yes** (after Cloudflare Access) |
| `https://chenpan-star.github.io/lf-confluence-catalog/` | **No** — still public; do not share |

To reduce leakage: stop sharing the `github.io` link; optionally ask IT if the origin can be blocked (Cloudflare cannot protect `*.github.io`).

#### Verify access works

```bash
# Without login — should NOT return catalog HTML (Access block or redirect)
curl -sI https://confluence-catalog.lotusflare.com/data/catalog.json | head -5
```

In a browser (logged out): opening the URL should show **Cloudflare/Okta login**, not the catalog.

---

## Daily Confluence refresh (optional)

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `ATLASSIAN_EMAIL`
   - `ATLASSIAN_API_TOKEN`
3. Workflow **Refresh Confluence catalog** runs daily at 06:00 UTC

Or run manually: **Actions** → **Refresh Confluence catalog** → **Run workflow**

After refresh commits new `catalog.json`, push triggers **Deploy to GitHub Pages** automatically.

---

## Slack reminders (copy & open)

**Send reminder** on the catalog copies a message and opens Slack so you can paste it into the last editor’s DM.

### Slack user ID map (optional)

Improves **Copy & open Slack** deep-links (maps Confluence names / emails → Slack member IDs).

1. Slack app → **OAuth & Permissions** → add Bot scope **`users:read`** → **Reinstall**
2. Put token in `.env` (never commit):
   ```env
   SLACK_BOT_TOKEN=xoxb-…
   ```
3. Export:
   ```bash
   npm run slack:export-users              # writes data/slack-users-export.json
   npm run slack:export-users -- --apply   # also merges into public/config/slack.json
   ```
4. Commit `public/config/slack.json` if you want the map on the live site.

**Monthly GitHub Action:** workflow `Refresh Slack user map` runs on the 1st of each month (and via **Actions → Run workflow**).

1. Repo **Settings → Secrets and variables → Actions** → secret **`SLACK_BOT_TOKEN`** (`xoxb-…`, scope `users:read`)
2. First run: **Actions → Refresh Slack user map → Run workflow**
3. On change it commits `public/config/slack.json`; push to `main` triggers Pages deploy

---

## If you use a different repo name

The build sets `VITE_BASE_PATH` from the repo name automatically.  
Your site URL will be:

```
https://<user>.github.io/<repo-name>/
```

---

## Local vs GitHub Pages

| | Local `npm run dev` | GitHub Pages |
|--|---------------------|--------------|
| URL | http://localhost:5174/ | https://….github.io/lf-confluence-catalog/ |
| Who sees it | Only you | Anyone with the link (or repo access) |
| Data refresh | `npm run refresh` on your Mac | GitHub Action + secrets |

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
Default in this repo: **`confluence-catalog.lotusflare.com`** (`public/CNAME`).

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

The `public/CNAME` file is copied into `dist/` on each deploy so GitHub keeps the domain configured.

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

### 5. Next: Okta (IT)

After the custom domain works, ask IT to add **Cloudflare Access** with **Okta** on that hostname.  
The GitHub Pages URL (`*.github.io/...`) will remain publicly reachable unless you stop using it or block it at the edge — treat the custom domain as the canonical internal URL.

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

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

#!/usr/bin/env bash
# Push GitHub Actions secrets for Option B (Deploy remind-track Worker).
# Prerequisites: gh auth login, Cloudflare API token + account id in env.
#
# Usage:
#   gh auth login
#   export CLOUDFLARE_API_TOKEN='...'
#   export CLOUDFLARE_ACCOUNT_ID='...'
#   ./scripts/setup-remind-worker-github.sh
#   gh workflow run deploy-remind-worker.yml -R chenpan-star/lf-confluence-catalog
#
# After the workflow succeeds, set the catalog URL (from the job summary):
#   gh variable set VITE_REMIND_TRACK_URL --body 'https://lf-catalog-remind-track.<subdomain>.workers.dev' -R chenpan-star/lf-confluence-catalog
# Then re-run "Deploy to GitHub Pages" or push to main.

set -euo pipefail

REPO="${GITHUB_REPO:-chenpan-star/lf-confluence-catalog}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login"
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN. Export it from Cloudflare → My Profile → API Tokens."
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Missing CLOUDFLARE_ACCOUNT_ID. Find it in Cloudflare dashboard → Workers & Pages (sidebar)."
  exit 1
fi

if [[ -z "${ATLASSIAN_EMAIL:-}" || -z "${ATLASSIAN_API_TOKEN:-}" ]]; then
  echo "Missing ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN in .env (same as catalog refresh)."
  exit 1
fi

if [[ -z "${REMIND_API_SECRET:-}" ]]; then
  REMIND_API_SECRET="$(openssl rand -hex 32)"
  echo "Generated new REMIND_API_SECRET (stored in GitHub Secrets only)."
fi

echo "Setting repository secrets on ${REPO}…"

gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN" -R "$REPO"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID" -R "$REPO"
gh secret set REMIND_API_SECRET --body "$REMIND_API_SECRET" -R "$REPO"
gh secret set ATLASSIAN_EMAIL --body "$ATLASSIAN_EMAIL" -R "$REPO"
gh secret set ATLASSIAN_API_TOKEN --body "$ATLASSIAN_API_TOKEN" -R "$REPO"
gh secret set VITE_REMIND_API_KEY --body "$REMIND_API_SECRET" -R "$REPO"

echo ""
echo "Done. Secrets configured (including VITE_REMIND_API_KEY for Pages build)."
echo ""
echo "Next:"
echo "  1. gh workflow run deploy-remind-worker.yml -R ${REPO}"
echo "  2. Open the run → Summary → copy the Worker URL"
echo "  3. gh variable set VITE_REMIND_TRACK_URL --body '<worker-url>' -R ${REPO}"
echo "  4. Re-run Deploy to GitHub Pages (Actions) or push an empty commit"

# Slack remind Worker

Cloudflare Worker that sends Confluence review reminders as Slack DMs.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | none |
| `POST` | `/api/slack/remind` | header `X-Remind-Key` |

Body example:

```json
{
  "contactName": "Linus Chui",
  "email": "linus.chui@lotusflare.com",
  "message": "Hi @linus.chui, …",
  "pageTitle": "Some page",
  "spaceName": "Product Catalog",
  "spaceKey": "PC",
  "confluenceUrl": "https://…",
  "catalogPageUrl": "https://…"
}
```

## Secrets

```bash
npm install
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put REMIND_API_KEY
npm run deploy
```

See root [DEPLOY.md](../../DEPLOY.md) for Slack app scopes and catalog wiring.

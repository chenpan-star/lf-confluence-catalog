# PROT Automation email (catalog reminders)

## Important: do not paste `{{issue.description}}` in the email body

Jira turns the issue description into **wiki markup** in email (`h2.`, `* bullets`, `[text|url]`). That looks broken next to your friendly HTML intro.

**Instead:** keep the email short and send people to the **task in Jira** (Description + @mention comment have formatted page lists after Worker deploy).

---

## Rule

| Step | Setting |
|------|--------|
| **Trigger** | Issue assigned |
| **Condition** | Labels contains `confluence-catalog` |
| **Action** | Send email |

**To:** `{{issue.assignee.emailAddress}}`

**Subject:**

```text
👋 Confluence doc review — {{issue.key}}
```

**Body (HTML)** — use this only (no `{{issue.description}}`):

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.6;color:#172B4D;max-width:640px">

<p style="margin:0 0 20px;font-size:20px;line-height:1.45;font-weight:600">👋 Hi {{issue.assignee.displayName}}!</p>

<p style="margin:0 0 18px;font-size:17px;line-height:1.6">Could you review some Confluence pages that may be out of date? Everything is on task <a href="{{issue.url}}" style="font-size:17px;color:#0052CC"><strong>{{issue.key}}</strong></a>.</p>

<p style="margin:0 0 18px;font-size:17px;line-height:1.6">📝 <strong>What to do:</strong> Open the task → use the page links in the <strong>Description</strong> (and the latest comment) → update, archive, or delete outdated pages → mark {{issue.key}} done when finished.</p>

<a href="{{issue.url}}" style="display:inline-block;margin:4px 0 20px;padding:14px 22px;font-size:17px;font-weight:600;color:#ffffff !important;background:#0052CC;text-decoration:none;border-radius:8px">Open {{issue.key}} in Jira</a>

<p style="margin:0;font-size:17px;line-height:1.6">🙏 Thanks for keeping our docs tidy!</p>

</div>
```

**Plain text:**

```text
👋 Hi {{issue.assignee.displayName}}!

Please review outdated Confluence pages on {{issue.key}}:
{{issue.url}}

Open the task — page titles and links are in the Description and in the assignee comment.

✅ When you're done, comment on or close the task.

🙏 Thanks!
```

---

## What assignees see in Jira (after Worker deploy)

The **Description** and **@mention comment** use the same friendly layout:

- 👋 greeting  
- 📝 what to do  
- 📌 task link  
- 📄 page list (title, **Open in Confluence**, space/status, plain URL line for copy/paste)  
- ✅ / 🙏 closing lines  

Redeploy:

```bash
npm run worker:remind:deploy
```

Create a **new** test issue (e.g. after deploy). Older issues like PROT-68 may still show legacy description text until recreated.

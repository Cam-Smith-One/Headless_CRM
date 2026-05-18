# Pipeline Brief Kit

A scheduled daily digest of your CRM pipeline — deals by stage, total value, deals that haven't moved in N days, and pending approvals — delivered wherever you want it (Telegram, Slack, email, or just logged).

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** onezeroten  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** onezeroten/headless-crm-connect

---

## What It Does

Every morning (configurable), your agent:

1. Queries all active deals from Headless CRM grouped by pipeline stage
2. Calculates total pipeline value and stage distribution
3. Flags deals that haven't changed stage in more than `STALE_DEAL_DAYS` days
4. Checks for pending approval requests that need human attention
5. Formats a concise brief (5 bullets max per section — no padding)
6. Delivers to your configured destination

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and verified
- A delivery destination: Telegram bot, Slack webhook, or Resend email

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Scheduling
PIPELINE_BRIEF_CRON=0 8 * * 1-5        # 8am Mon–Fri
PIPELINE_BRIEF_TIMEZONE=America/New_York

# Behaviour
STALE_DEAL_DAYS=7                        # flag deals not moved in N days
MAX_BULLETS_PER_SECTION=5

# Delivery — choose one
TELEGRAM_BOT_TOKEN=                      # Telegram delivery
TELEGRAM_CHAT_ID=
SLACK_WEBHOOK_URL=                       # Slack delivery
PIPELINE_BRIEF_EMAIL_TO=                 # Email delivery (requires Resend)
RESEND_API_KEY=
EMAIL_FROM=crm@yourcompany.com
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

Verify with: *"How many contacts are in my CRM?"*

### 2. Configure delivery

**Telegram:**
1. Create a bot via [@BotFather](https://t.me/BotFather) → copy the token
2. Find your chat ID — send a message to the bot then `GET https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

**Slack:**
1. Create an incoming webhook at api.slack.com/apps
2. Set `SLACK_WEBHOOK_URL`

**Email:**
1. Set `PIPELINE_BRIEF_EMAIL_TO`, `RESEND_API_KEY`, `EMAIL_FROM`

### 3. Schedule the cron

Add to your agent's cron configuration:

```json
{
  "schedule": "0 8 * * 1-5",
  "timezone": "America/New_York",
  "prompt": "Run the pipeline brief workflow",
  "skill": "pipeline-brief"
}
```

### 4. Run a test

Ask your agent: *"Run the pipeline brief now"*

You should receive a formatted digest within 10 seconds.

---

## Workflow (what the agent does)

```
1. crm_query deals { stateCode: "active", limit: 200 }
2. Group deals by stage → calculate value per stage
3. Flag deals where updatedAt < (today - STALE_DEAL_DAYS)
4. crm_query approvals { status: "pending" }
5. Format brief (skip empty sections)
6. POST to delivery destination
7. Log activity: crm_log_activity { type: "agent_action", note: "Pipeline brief sent" }
```

---

## Brief Format

```
📊 Pipeline Brief — Monday 19 May

💰 Total Pipeline: $392,600 across 10 deals

📍 By Stage
• Prospecting: 1 deal · $45,000 (5%)
• Qualified: 5 deals · $196,000 (50%)
• Proposal: 4 deals · $151,600 (45%)

⏰ Stale Deals (7+ days)
• Acme Corp — Qualified — last moved 12 days ago
• Nexus AI — Prospecting — last moved 9 days ago

✅ Pending Approvals: 2 requests need your attention
→ http://localhost:3000/approvals
```

Empty sections are omitted. No filler text.

---

## Failure Patterns and Mitigations

**No deals returned** — stateCode filter may be wrong for your data. Try removing it and check what `crm_query deals {}` returns. Seed data uses `"active"`.

**Stale deal detection is wrong** — check `STALE_DEAL_DAYS` is set. Default is 7 if unset.

**Telegram delivery fails** — verify the bot has been started by sending `/start` to it. The chat ID for groups is negative (e.g. `-1001234567890`).

**Slack 400** — the webhook URL has expired or the app was removed. Re-create the webhook.

**Cron not firing** — verify your agent runtime supports scheduled execution and the cron expression is correct for your timezone.

---

## Constraints

- Fetches up to 200 deals per run. For pipelines with more than 200 active deals, paginate by adding an offset loop or filter by specific pipelines using `pipelineId`.
- Semantic search is not used — this kit uses structured `crm_query` calls only, so it works with both SQLite and Postgres backends.
- The brief is read-only. It never modifies CRM data except for the optional activity log entry.

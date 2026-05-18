# Weekly Sales Review Kit

A Monday-morning narrative digest of the previous week's sales activity — deals won and lost, new deals created, pipeline movement, top performers by activity count, a forecast for deals expected to close this week, and any deals that regressed in stage. Richer and more retrospective than the daily pipeline-brief, this kit tells the story of the week with trends and comparisons.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

Every Monday morning (configurable), your agent:

1. Queries all deals updated in the last 7 days to identify wins, losses, new deals, and stage movements
2. Detects regressions — deals that moved backwards in stage using `crm_stage_history`
3. Counts activities per contact/deal to surface top performers
4. Calculates a weekly forecast: deals with `expectedCloseDate` within the next 7 days
5. Compares pipeline value this week vs last week (net change)
6. Formats a structured weekly narrative with sections for each theme
7. Delivers to Telegram, Slack, or email

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
REVIEW_CRON=0 8 * * 1              # 8am every Monday
REVIEW_TIMEZONE=America/New_York

# Delivery — choose one
TELEGRAM_BOT_TOKEN=                # Telegram delivery
TELEGRAM_CHAT_ID=
SLACK_WEBHOOK_URL=                 # Slack delivery
RESEND_API_KEY=                    # Email delivery
WEEKLY_REVIEW_EMAIL_TO=
EMAIL_FROM=crm@yourcompany.com
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

Verify with: *"How many deals are in my CRM?"*

### 2. Configure delivery

**Telegram:**
1. Create a bot via [@BotFather](https://t.me/BotFather) → copy the token
2. Find your chat ID — send a message to the bot then `GET https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

**Slack:**
1. Create an incoming webhook at api.slack.com/apps
2. Set `SLACK_WEBHOOK_URL`

**Email:**
1. Set `WEEKLY_REVIEW_EMAIL_TO`, `RESEND_API_KEY`, `EMAIL_FROM`

### 3. Schedule the cron

Add to your agent's cron configuration:

```json
{
  "schedule": "0 8 * * 1",
  "timezone": "America/New_York",
  "prompt": "Run the weekly sales review",
  "skill": "weekly-sales-review"
}
```

### 4. Run a test

Ask your agent: *"Run the weekly sales review now"*

You should receive a full narrative digest within 15 seconds.

---

## Workflow (what the agent does)

```
1. Determine date window: lastWeekStart = Monday 00:00, lastWeekEnd = Sunday 23:59

2. crm_query deals { updatedAt_gte: lastWeekStart, updatedAt_lte: lastWeekEnd, limit: 200 }
   → partition into: won (stage="closed_won"), lost (stage="closed_lost"),
     created (createdAt >= lastWeekStart), moved (stage changed)

3. For each deal flagged as moved:
   crm_stage_history { dealId: deal.id }
   → detect regressions (current stage index < previous stage index)

4. crm_query activities { createdAt_gte: lastWeekStart, limit: 500 }
   → count per contact → rank top 5 by activity count

5. crm_query deals { expectedCloseDate_gte: today, expectedCloseDate_lte: today+7d,
     stage_not_in: ["closed_won","closed_lost"], limit: 50 }
   → forecast list

6. Calculate pipeline delta:
   - crm_query deals { stateCode: "active", limit: 200 } → current total value
   - Derive last week's total from the updated deals delta

7. Format weekly narrative (omit empty sections)

8. POST to delivery destination

9. crm_log_activity { type: "agent_action",
     note: "Weekly sales review sent — W/L: X/Y, forecast: $Z" }
```

---

## Output Summary Format

```
📅 Weekly Sales Review — Week of 12–18 May

🏆 Deals Won (2) · $84,000
• Acme Corp — Enterprise Plan · $55,000
• Bloom Health — Starter · $29,000

💔 Deals Lost (1) · $22,000
• Vertix Ltd — competitor selected

🆕 New Deals Created (3) · $67,500
• Nexus AI · $30,000 · Prospecting
• Orbit Media · $20,000 · Qualified
• Sunrise Co · $17,500 · Prospecting

📈 Pipeline Movement
• 4 deals advanced stage
• Net pipeline change: +$45,500 vs last week

⚠️ Regressions (1)
• TechFlow Inc moved backwards: Proposal → Qualified

🔮 Forecast This Week (3 deals · $110,000)
• Dune Analytics · $60,000 · close by Fri
• Crest Partners · $30,000 · close by Thu
• Maple Systems · $20,000 · close by Wed

🏅 Top Activity (last 7 days)
• Sarah Chen — 12 activities (8 emails, 4 calls)
• James Okafor — 9 activities
```

Empty sections are omitted. No filler text.

---

## Failure Patterns and Mitigations

**No deals returned for last week** — verify `updatedAt` filters are supported by your backend. If not, fetch all active deals and filter client-side by date.

**Stage history unavailable** — if `crm_stage_history` returns an error, skip the regression section and note it in the output rather than failing the entire run.

**Activity counts are zero** — activities may be stored under a different collection name. Check `crm_query { collection: "activities" }` directly and confirm the schema.

**Forecast is empty** — `expectedCloseDate` may not be populated on your deals. Prompt your team to add close dates, or skip the section silently.

**Telegram delivery fails** — verify the bot has been started by sending `/start` to it. Group chat IDs are negative (e.g. `-1001234567890`).

**Cron fires but nothing arrives** — check agent runtime logs. The cron expression `0 8 * * 1` fires at 8am Monday in the configured timezone only.

---

## Constraints

- Fetches up to 200 deals and 500 activities per run. High-volume pipelines should add `pipelineId` filters.
- Regression detection requires `crm_stage_history` to return ordered history with timestamps. If history is unavailable, this section is skipped.
- This kit is read-only except for the single summary activity log entry.
- Pipeline delta is approximate when more than 200 deals are active; use `pipelineId` scoping for accuracy.

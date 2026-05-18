# Skill: Weekly Sales Review

## Purpose

Generate and deliver a structured Monday-morning narrative covering the previous week's sales activity: deals won and lost, new deals, pipeline movement, regressions, top performer activity counts, and a forecast for the coming week.

## When to Use

- When the user asks for a weekly sales review, week-in-review, or weekly digest
- When this skill fires on its Monday morning cron schedule
- When the user asks "how did last week go?" or "what's the forecast for this week?"

## Steps

### 1. Define the date window

Set `lastWeekStart` to the most recent Monday at 00:00 and `lastWeekEnd` to the following Sunday at 23:59 (both in `REVIEW_TIMEZONE`, default UTC). Set `today` and `nextWeekEnd` (today + 7 days) for the forecast window.

### 2. Fetch last week's deals

```json
{ "collection": "deals", "filters": { "updatedAt_gte": "[lastWeekStart]", "updatedAt_lte": "[lastWeekEnd]" }, "limit": 200 }
```

Partition results:
- **Won**: `stage === "closed_won"` and `updatedAt` within window
- **Lost**: `stage === "closed_lost"` and `updatedAt` within window
- **New**: `createdAt >= lastWeekStart`
- **Moved**: stage changed during the window (use `crm_stage_history` to confirm)

### 3. Detect regressions

For each deal that moved stage, call:
```json
{ "tool": "crm_stage_history", "dealId": "[deal.id]" }
```

A regression is when the most recent stage transition moved to a stage with a lower index in the standard pipeline order: `[Prospecting, Qualified, Proposal, Negotiation, Closed Won]`.

Collect regressed deals into a list with their previous and current stage.

### 4. Count activity top performers

```json
{ "collection": "activities", "filters": { "createdAt_gte": "[lastWeekStart]" }, "limit": 500 }
```

Group by `contactId` or `assignedTo`. Rank the top 5 by total activity count. For the top entry, break down by activity type (email, call, meeting, note) if the data is available.

### 5. Build the forecast

```json
{ "collection": "deals", "filters": { "expectedCloseDate_gte": "[today]", "expectedCloseDate_lte": "[nextWeekEnd]", "stage_not_in": ["closed_won", "closed_lost"] }, "limit": 50 }
```

Sort by `expectedCloseDate` ascending. Cap at 5 deals in the output.

### 6. Calculate pipeline delta

- Fetch current active pipeline: `crm_query { collection: "deals", filters: { stateCode: "active" }, limit: 200 }`
- Sum `value` for all active deals → `currentPipelineValue`
- Estimate last week's value: `currentPipelineValue − sum(wonValues) − sum(newDealValues) + sum(lostValues)`
- Report net change as `+$X` or `−$X`

### 7. Format the review

Structure (omit any section where the list is empty):

```
📅 Weekly Sales Review — Week of [D Mon – D Mon]

🏆 Deals Won ([N]) · $[total]
• [Company] — [Deal Name] · $[value]
[max 5, sorted by value desc]

💔 Deals Lost ([N]) · $[total]
• [Company] — [reason if available]
[max 5]

🆕 New Deals Created ([N]) · $[total]
• [Company] · $[value] · [Stage]
[max 5, sorted by value desc]

📈 Pipeline Movement
• [N] deals advanced stage
• Net pipeline change: [+/−]$[delta] vs last week

⚠️ Regressions ([N])
• [Company] moved backwards: [PrevStage] → [CurrentStage]
[max 5]

🔮 Forecast This Week ([N] deals · $[total])
• [Company] · $[value] · close by [Day]
[max 5, sorted by close date asc]

🏅 Top Activity (last 7 days)
• [Name] — [N] activities[( breakdown if available)]
• [Name] — [N] activities
[top 5]
```

Rules:
- Skip sections with zero items entirely — never write "None" or "Nothing to report"
- Dollar values use `$` with comma formatting for values over $1,000
- Percentages rounded to nearest whole number
- Day names for forecast (Mon/Tue/etc.) not full dates

### 8. Deliver

Check environment for delivery method in this order:
1. `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` → POST to Telegram sendMessage API
2. `SLACK_WEBHOOK_URL` → POST JSON `{ "text": "..." }` to webhook
3. `WEEKLY_REVIEW_EMAIL_TO` + `RESEND_API_KEY` → send via Resend API with subject "Weekly Sales Review — [date range]"
4. None set → output the review as a formatted message to the user

### 9. Log

```json
{
  "recordType": "agent_action",
  "note": "Weekly sales review delivered — Won: $[X], Lost: $[Y], Forecast: $[Z]"
}
```

## Outputs

- A formatted multi-section sales narrative delivered to the configured destination
- One activity log entry summarising the run

## Notes

- If `crm_stage_history` is unavailable or returns an error, skip the regressions section silently and continue
- If `expectedCloseDate` is not populated on any deals, skip the forecast section
- Requires `headless-crm-connect` kit installed and `crm_*` tools available
- Works with both SQLite and Postgres Headless CRM backends

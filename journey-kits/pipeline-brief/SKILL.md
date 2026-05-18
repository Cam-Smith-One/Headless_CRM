# Pipeline Brief

Generate and deliver a concise daily digest of the CRM pipeline — deals by stage, total value, stale deals, and pending approvals.

## Instructions

When the user asks for a pipeline brief, pipeline summary, or this skill fires on schedule:

### 1. Fetch pipeline data

Call `crm_query` with:
```json
{ "collection": "deals", "filters": { "stateCode": "active" }, "limit": 200 }
```

### 2. Fetch pending approvals

Call `crm_query` with:
```json
{ "collection": "approvals", "filters": { "status": "pending" }, "limit": 50 }
```

### 3. Calculate metrics

From the deals list:
- Total pipeline value (sum of `value` field)
- Count and value per stage
- Deals where `updatedAt` is older than `STALE_DEAL_DAYS` days (default: 7)

### 4. Format the brief

Structure:
```
📊 Pipeline Brief — [Day Date]

💰 Total Pipeline: $[value] across [N] deals

📍 By Stage
• [Stage]: [N] deal(s) · $[value] ([%])
[max 5 stages, sorted by value desc]

⏰ Stale Deals ([N]+ days)
• [Company] — [Stage] — last moved [N] days ago
[max 5, oldest first]
[omit section if none]

✅ Pending Approvals: [N] request(s) need your attention
→ [HEADLESS_CRM_API_URL replaced with dashboard URL]/approvals
[omit section if none]
```

**Rules:**
- Skip any section with zero items — never write "None" or "No stale deals"
- Cap each section at 5 bullets
- Use `$` formatting with commas for values over $1,000
- Percentages are of total pipeline value, rounded to nearest whole number

### 5. Deliver

Check environment for delivery method in this order:
1. `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` → POST to Telegram sendMessage API
2. `SLACK_WEBHOOK_URL` → POST JSON `{ "text": "..." }` to Slack
3. `PIPELINE_BRIEF_EMAIL_TO` + `RESEND_API_KEY` → send via Resend API
4. None set → output the brief as a formatted message to the user

### 6. Log (optional)

If `crm_log_activity` is available and role permits:
```json
{
  "recordType": "agent_action",
  "note": "Pipeline brief delivered — $[value] pipeline, [N] deals, [N] stale"
}
```

## Error Handling

- If `crm_query` returns 0 deals: deliver a brief noting "No active deals found" and stop — do not call delivery APIs with empty content
- If delivery fails: report the error to the user with the formatted brief text so they can see it regardless
- If `STALE_DEAL_DAYS` is not set: default to 7

## Constraints

- Read-only except for the optional activity log
- Works with both SQLite and Postgres Headless CRM backends
- Requires `headless-crm-connect` kit installed and `crm_*` tools available

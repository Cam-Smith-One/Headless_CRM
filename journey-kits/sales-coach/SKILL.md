# Skill: Sales Coach

## Purpose

Analyse recent deal activity and produce a prioritised coaching brief that surfaces deals needing attention: no next step, overdue inbound response, stage stagnation, and contacts with no call or meeting on record. Optionally logs coaching notes directly to each deal.

## When to Use

- When the user asks for a coaching review, "which deals need attention?", "what should I focus on?", or "coach me on my pipeline"
- When this skill fires on its weekly cron schedule
- When a sales manager asks for a team pipeline health check

## Steps

### 1. Fetch active deals

```json
{ "collection": "deals", "filters": { "stateCode": "active" }, "limit": 30, "sort": "updatedAt_asc" }
```

Use `MAX_DEALS_REVIEWED` (default 30) as the limit. Sort by `updatedAt_asc` to surface least-recently-touched deals first.

### 2. Fetch activities for each deal

For each deal returned:
```json
{ "collection": "activities", "filters": { "dealId": "[deal.id]" }, "limit": 20, "sort": "createdAt_desc" }
```

### 3. Apply flag rules

For each deal, apply the following flags independently (a deal can have multiple):

**NO_ACTIVITY** — no activities exist with `createdAt >= (today − COACHING_LOOKBACK_DAYS)`. Default lookback: 14 days.

**INBOUND_WAIT** — the most recent activity has `type` of `inbound_email` or `inbound_message`, and its `createdAt` is more than 24 hours ago.

**STAGE_STUCK** — `deal.updatedAt < (today − AVG_STAGE_DURATION_DAYS)` and stage is not `closed_won` or `closed_lost`. Default threshold: 7 days.

**NO_CALL** — query activities for the deal's `contactId` filtered to `type_in: ["call", "meeting"]` with `limit: 1`. If empty, flag NO_CALL.

```json
{ "collection": "activities", "filters": { "contactId": "[deal.contactId]", "type": "call" }, "limit": 1 }
```

(Run a second query for `type: "meeting"` if the backend does not support `type_in`.)

### 4. Score and rank

Assign a priority score to each flagged deal:

```
score = (days_since_last_activity × 2)
      + (days_in_current_stage × 1.5)
      + (INBOUND_WAIT flag × 10)
      + (NO_CALL flag × 5)
```

Sort descending. Assign tiers:
- Score ≥ 20 → 🔴 High Priority
- Score 10–19 → 🟡 Medium Priority
- Score < 10 → 🟢 Low Priority

### 5. Generate suggestion for each flagged deal

One specific, actionable line per deal based on its flags (combine if multiple):

| Flag | Suggestion template |
|------|---------------------|
| INBOUND_WAIT | "Reply to [contactName]'s [activity type] from [date] — [subject or note snippet if available]" |
| STAGE_STUCK | "Review blockers in [Stage] — been here [N] days (team avg: [AVG_STAGE_DURATION_DAYS])" |
| NO_ACTIVITY | "Re-engage — no activity in [N] days. Consider a value-add follow-up or check-in call." |
| NO_CALL | "Book a discovery or check-in call — no call or meeting ever logged for [contactName]" |

When multiple flags apply, lead with the highest-urgency flag and append the others as "Also: [flag]".

### 6. Optionally log coaching notes

If `COACH_OUTPUT=activities` (not the default):

For each flagged deal, call:
```json
{
  "tool": "crm_log_activity",
  "dealId": "[deal.id]",
  "type": "coaching_note",
  "note": "[suggestion text]"
}
```

### 7. Format the coaching brief

```
🎯 Sales Coaching Brief — [Date]

[N] deals flagged across [M] issue types.

🔴 High Priority
[N]. [Company] · [Stage] · [key metric, e.g. "14 days in stage"]
   → [suggestion]
   Issues: [FLAGS]

🟡 Medium Priority
...

🟢 Low Priority
...

---
[If COACH_OUTPUT=activities]: Actions logged to CRM: [N] coaching notes
[If COACH_OUTPUT=brief]: Review suggestions above and take action in your CRM.
```

Rules:
- List deals within each tier sorted by score descending
- Cap total output at `MAX_DEALS_REVIEWED` deals
- Skip empty tiers entirely
- Never write "No issues found" in a tier — omit the tier

## Outputs

- A prioritised coaching brief with one actionable suggestion per flagged deal
- Optionally: one `coaching_note` activity logged per flagged deal (when `COACH_OUTPUT=activities`)

## Notes

- If `crm_log_activity` fails for individual deals when `COACH_OUTPUT=activities`, continue processing remaining deals and report failures at the end
- `COACH_OUTPUT` defaults to `brief` — the agent never writes to the CRM unless explicitly configured
- Requires `headless-crm-connect` kit installed and `crm_*` tools available
- Works with both SQLite and Postgres Headless CRM backends

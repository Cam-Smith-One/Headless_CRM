# Sales Coach Kit

Analyses recent deal activity to surface coaching opportunities: deals with no next step logged, deals where the last touch was inbound (the ball is in your court), deals stuck in a stage longer than average, and contacts with no meeting or call on record. Produces a prioritised, actionable coaching brief with a specific recommendation for each flagged deal. Run on demand or on a weekly schedule.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

On demand or on schedule, your agent:

1. Queries recent deals (within `COACHING_LOOKBACK_DAYS`) and their activity history
2. Flags deals with no activity in the lookback window
3. Identifies deals where the most recent activity was inbound (email/message from prospect) — response overdue
4. Detects deals that have been in their current stage longer than `AVG_STAGE_DURATION_DAYS`
5. Finds contacts linked to active deals that have never had a call or meeting logged
6. Ranks all flagged items by urgency (stage age + inbound wait time)
7. Generates a specific, actionable suggestion for each flagged deal
8. Either outputs a coaching brief or logs a coaching note directly to each deal depending on `COACH_OUTPUT`

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and verified

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Behaviour
COACHING_LOOKBACK_DAYS=14           # how far back to look for activity gaps
AVG_STAGE_DURATION_DAYS=7           # flag deals stuck longer than this
MAX_DEALS_REVIEWED=30               # cap on deals analysed per run
COACH_OUTPUT=brief                  # "brief" (summary output) or "activities" (log to each deal)
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

Verify with: *"How many deals are in my CRM?"*

### 2. Configure behaviour

Set `COACHING_LOOKBACK_DAYS` to match your typical deal velocity. For fast-moving pipelines use 7; for enterprise deals use 21 or more.

Set `AVG_STAGE_DURATION_DAYS` to your team's benchmark. If you don't know it yet, start with 7 and adjust after a few runs.

Set `COACH_OUTPUT=activities` to have the agent log a coaching note directly on each deal. Use `brief` to review recommendations before acting.

### 3. Run on demand

Ask your agent: *"Run the sales coaching review"* or *"Which deals need attention?"*

### 4. Optional: schedule weekly

```json
{
  "schedule": "0 9 * * 1",
  "timezone": "America/New_York",
  "prompt": "Run the sales coaching review",
  "skill": "sales-coach"
}
```

---

## Workflow (what the agent does)

```
1. crm_query deals { stateCode: "active", limit: MAX_DEALS_REVIEWED }

2. For each deal:
   crm_query activities { dealId: deal.id, limit: 20, sort: "createdAt_desc" }

   → Flag NO_ACTIVITY if no activities within COACHING_LOOKBACK_DAYS
   → Flag INBOUND_WAIT if most recent activity type is "inbound_email" or
     "inbound_message" and it is older than 24h
   → Flag STAGE_STUCK if deal.updatedAt < (today - AVG_STAGE_DURATION_DAYS)
     and stage not in ["closed_won", "closed_lost"]

3. For each unique contactId on flagged deals:
   crm_query activities { contactId: contact.id,
     type_in: ["call","meeting"], limit: 1 }
   → Flag NO_CALL if result is empty

4. Rank flagged deals:
   Priority score = (days_since_last_activity × 2)
                  + (days_in_stage × 1.5)
                  + (is_inbound_wait × 10)
                  + (no_call_ever × 5)

5. Generate coaching suggestion for each flagged deal (top MAX_DEALS_REVIEWED):
   - NO_ACTIVITY → "Schedule a check-in call — last touch was [N] days ago"
   - INBOUND_WAIT → "Reply to [contact]'s message from [date] before [tomorrow]"
   - STAGE_STUCK → "Review blockers in [Stage] — been here [N] days (avg: AVG_STAGE_DURATION_DAYS)"
   - NO_CALL → "Log a discovery call — no call or meeting on record for [contact]"

6. If COACH_OUTPUT=activities:
   crm_log_activity { dealId: deal.id, type: "coaching_note",
     note: "[suggestion]" }
   for each flagged deal

7. Format and output coaching brief
```

---

## Output Summary Format

```
🎯 Sales Coaching Brief — 18 May

5 deals flagged across 3 issue types.

🔴 High Priority
1. TechFlow Inc · Proposal · 14 days in stage (avg: 7)
   → Review blockers with champion — consider discounting or re-scoping
   Issues: STAGE_STUCK, NO_CALL

2. Nexus AI · Qualified · Inbound email unanswered 3 days
   → Reply to Sarah Kim's email from 15 May — she asked about pricing
   Issues: INBOUND_WAIT

🟡 Medium Priority
3. Orbit Media · Prospecting · No activity in 11 days
   → Send a value-add follow-up or schedule a call
   Issues: NO_ACTIVITY

4. Crest Partners · Negotiation · 9 days in stage
   → Confirm decision timeline and next stakeholder meeting
   Issues: STAGE_STUCK

🟢 Logged
5. Maple Systems · Qualified · No call or meeting ever logged
   → Book an intro call — contact has only been emailed
   Issues: NO_CALL

---
Actions logged to CRM: 5 coaching notes
```

---

## Failure Patterns and Mitigations

**All deals flagged as STAGE_STUCK** — `AVG_STAGE_DURATION_DAYS` is too low for your pipeline. Increase it to match your actual sales cycle length.

**No inbound activities detected** — your team may not be distinguishing inbound vs outbound activity types. Coach them to log `inbound_email` and `inbound_message` types, or adjust the flag logic to use activity metadata.

**Activity log write fails with COACH_OUTPUT=activities** — the agent token may lack write permissions. Set `COACH_OUTPUT=brief` to review suggestions without writing to the CRM.

**Deals with no activities at all** — new deals created but never touched will always appear. Filter them out by excluding deals created within the last 24 hours if noise is high.

**MAX_DEALS_REVIEWED cap too low** — for large pipelines, increase to 50–100 and expect slightly longer run times.

---

## Constraints

- Reads up to `MAX_DEALS_REVIEWED` deals per run (default 30). Deals are fetched in default sort order; add `sort: "updatedAt_asc"` to prioritise the least-recently-touched.
- Coaching suggestions are generated by the agent based on flagged conditions — they are not sourced from external AI calls. The quality improves when activity types are logged consistently.
- `COACH_OUTPUT=activities` requires write permissions on the CRM token.
- This kit does not send messages to prospects. It coaches the sales team.

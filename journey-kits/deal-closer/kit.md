# Deal Closer Kit

An agent workflow that monitors all active deals, identifies those approaching their expected close date or stalled in the same stage, ranks them by urgency, and optionally requests human approval to advance or close each one.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Queries all active deals and filters by `MIN_DEAL_VALUE`
2. Flags deals whose `expectedCloseDate` falls within the next `CLOSE_WINDOW_DAYS` days
3. Flags deals that have not changed stage in `STALE_THRESHOLD_DAYS` days using `crm_stage_history`
4. Ranks all flagged deals by urgency (days to close, deal value, stall duration)
5. Logs an `agent_action` activity on each flagged deal with the urgency reason
6. When `AUTO_REQUEST_APPROVAL` is true, creates an approval request to advance or close each deal
7. Delivers a prioritised action list sorted by urgency score

Run on demand, on a schedule, or as a morning briefing before your sales stand-up.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and operator (or developer) role
- Deals must have `expectedCloseDate` populated for close-window detection to work

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Detection behaviour
CLOSE_WINDOW_DAYS=14          # flag deals closing within this many days
STALE_THRESHOLD_DAYS=10       # flag deals not moved in this many days
MIN_DEAL_VALUE=0              # ignore deals below this value (in your currency)
AUTO_REQUEST_APPROVAL=true    # create approval requests for each flagged deal
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Configure thresholds

Set `CLOSE_WINDOW_DAYS` and `STALE_THRESHOLD_DAYS` to match your typical sales cycle. For a 30-day cycle, `CLOSE_WINDOW_DAYS=7` and `STALE_THRESHOLD_DAYS=5` is a reasonable starting point.

### 3. Run on demand or schedule

Ask your agent: *"Show me deals that need attention this week"*

Or add to your cron for a daily morning briefing:
```json
{
  "schedule": "0 8 * * 1-5",
  "prompt": "Run deal closer and surface any deals needing action today",
  "skill": "deal-closer"
}
```

---

## Workflow (what the agent does)

```
1. crm_query deals { filters: { stage_not_in: ["Closed Won", "Closed Lost"] }, limit: 200 }
   Filter out deals where value < MIN_DEAL_VALUE

For each active deal:
2. crm_stage_history { recordType: "deals", recordId: deal.id }
   → compute days_in_current_stage = today - last_stage_change_date

3. Classify:
   CLOSING_SOON = expectedCloseDate is within CLOSE_WINDOW_DAYS days (or overdue)
   STALLED      = days_in_current_stage >= STALE_THRESHOLD_DAYS

4. Skip deals that are neither CLOSING_SOON nor STALLED

5. crm_log_activity {
     recordType: "deals", recordId: deal.id,
     type: "agent_action",
     note: "Deal flagged: [CLOSING_SOON / STALLED — N days in stage]. Action required."
   }

6. If AUTO_REQUEST_APPROVAL = true:
   crm_request_approval {
     type: "deal_advance",
     title: "Review [deal.name] — [CLOSING_SOON: closes DD Mon / STALLED: N days in [stage]]",
     context: { dealId, value, stage, daysToClose, daysInStage }
   }

7. Compute urgency_score per deal:
   = (1 / max(daysToClose, 1)) * 1000 + (daysInStage * 10) + (value / 10000)

8. Sort flagged deals by urgency_score desc and deliver summary
```

---

## Output Summary Format

```
🚨 Deal Closer — 19 May 2026

Active deals scanned: 34   Flagged: 8   Below MIN_DEAL_VALUE: 3

🔴 Closing Soon (within 14 days)
  1. Acme Corp — Enterprise Licence    $48,000   closes 23 May  (Stage: Negotiation)
  2. NovaTech — Starter Bundle         $12,500   closes 28 May  (Stage: Proposal)
  3. Bright Labs — Annual Plan          $9,000   closes 01 Jun  (Stage: Proposal)

🟡 Stalled (no stage movement in ≥ 10 days)
  4. DataStream Inc — Pro Tier         $22,000   14 days in Qualified
  5. Vertex AI — Growth Plan           $18,500   12 days in Discovery
  6. Pelican SaaS — Team Licence        $7,200   11 days in Proposal

📋 6 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**`expectedCloseDate` is null on many deals** — the close-window check is skipped for those deals; only the stall check applies. Add a required close date to your deal creation workflow to get full coverage.

**Stage history returns empty** — the deal was created before stage history tracking was enabled. The agent treats these as having an unknown stall duration and notes it in the activity log; they are excluded from STALLED classification but still included if CLOSING_SOON.

**Too many approval requests created** — raise `STALE_THRESHOLD_DAYS` or `MIN_DEAL_VALUE` to narrow the flagged set. Alternatively set `AUTO_REQUEST_APPROVAL=false` and use the summary output only.

**Deal is already Closed Won/Lost but still appears** — the stage filter depends on stage names matching exactly. Verify the stage names in your pipeline match the exclusion list, and update the query filter if you use custom stage names.

---

## Constraints

- Scans up to 200 active deals per run. Pipelines with more than 200 open deals should add a `pipelineId` filter to scope the query.
- Urgency scoring is a heuristic — it ranks deals for review, not for automatic closure. All stage advances require human approval.
- `MIN_DEAL_VALUE=0` includes all deals regardless of value; set a meaningful floor to avoid noise from low-value pipeline clutter.
- Works with both SQLite and Postgres Headless CRM backends.

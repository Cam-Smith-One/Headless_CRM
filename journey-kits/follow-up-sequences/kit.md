# Follow-Up Sequences Kit

An agent workflow that finds contacts and deals with no recent activity, drafts a personalised follow-up note for each based on their deal stage and last interaction, logs it as an activity, and optionally requests human approval before the note is treated as ready to send.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Queries contacts (optionally filtered by `FOLLOW_UP_STAGE_FILTER`) whose last activity is older than `FOLLOW_UP_DAYS` days
2. Skips contacts tagged `do-not-contact`
3. For each contact, retrieves their open deal, company record, and most recent activity to understand context
4. Drafts a short, personalised follow-up note tuned to the deal stage and last activity type
5. Logs the draft as a `follow_up` activity on the contact record
6. When `REQUIRE_APPROVAL` is true, creates an approval request before the note is considered send-ready
7. Delivers a run summary listing every drafted follow-up

Run on demand or on a daily schedule to keep your pipeline warm.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and operator (or developer) role
- Contacts must have activities logged against them for the last-activity check to work; contacts with zero activities are treated as overdue immediately

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Follow-up behaviour
FOLLOW_UP_DAYS=5                           # contacts with no activity in this many days are eligible
FOLLOW_UP_STAGE_FILTER=Qualified,Proposal  # comma-separated stage names to include; leave empty for all stages
MAX_CONTACTS_PER_RUN=20                    # cap to avoid overly long runs
REQUIRE_APPROVAL=true                      # create approval request before treating note as send-ready
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Configure stage filter

Set `FOLLOW_UP_STAGE_FILTER` to the stages where outreach is appropriate. Leaving it empty processes contacts at all active stages, which can produce a large run. Start narrow and widen as needed.

### 3. Run on demand or schedule

Ask your agent: *"Draft follow-ups for any contacts I haven't touched in 5 days"*

Or add to your cron for a daily sweep:
```json
{
  "schedule": "0 8 * * 1-5",
  "prompt": "Run follow-up sequences for contacts needing outreach today",
  "skill": "follow-up-sequences"
}
```

---

## Workflow (what the agent does)

```
1. Build stage filter from FOLLOW_UP_STAGE_FILTER (split on comma, trim whitespace)
   crm_query contacts {
     filters: { stage_in: [<stages>] },   // omit filter if FOLLOW_UP_STAGE_FILTER is empty
     limit: MAX_CONTACTS_PER_RUN
   }

For each contact:
2. Skip if tags include "do-not-contact"

3. crm_query activities {
     filters: { recordType: "contacts", recordId: contact.id },
     sort: { field: "createdAt", order: "desc" },
     limit: 1
   }
   → last_activity_date = activity.createdAt (or contact.createdAt if no activities)
   → days_since = today - last_activity_date
   → Skip if days_since < FOLLOW_UP_DAYS

4. crm_get deals — find open deal linked to contact (contactId = contact.id, stage not closed)
5. crm_get companies/<contact.companyId>   (if companyId is set)

6. Draft follow-up note:
   Inputs: contact name, company name, deal stage, deal name, last activity type + note snippet
   Tone:   warm, concise, one to three sentences, no hollow filler phrases
   Examples by stage:
     Discovery   → reference the problem discussed, ask if anything has changed
     Qualified   → reference their evaluation criteria, offer to answer questions
     Proposal    → reference the proposal sent, ask about next steps or blockers
     Negotiation → reference the outstanding terms, offer to schedule a call

7. crm_log_activity {
     recordType: "contacts", recordId: contact.id,
     type: "follow_up",
     note: "[DRAFT] <follow-up note text>"
   }

8. If REQUIRE_APPROVAL = true:
   crm_request_approval {
     type: "outreach",
     title: "Send follow-up to <First Last> (<Company>) — <N> days since last contact",
     context: { contactId, dealId, daysOverdue: days_since, draftNote: "<text>" }
   }

9. Deliver summary of all drafted follow-ups
```

---

## Output Summary Format

```
📬 Follow-Up Sequences — 19 May 2026

Contacts evaluated: 18   Skipped (do-not-contact): 2   Below FOLLOW_UP_DAYS: 9

✉️  Drafted follow-ups: 7

  1. Sarah Chen @ TechFlow  (Proposal — 8 days overdue)
     Draft: "Hi Sarah, wanted to check in on the proposal we sent over last week…"
     → Approval requested

  2. Marcus Johnson @ Nexus AI  (Qualified — 6 days overdue)
     Draft: "Hey Marcus, following up on our conversation about your data pipeline…"
     → Approval requested

  [+ 5 more]

📋 7 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**Contact has no open deal** — the follow-up note is drafted using contact and company fields only, without deal-stage context. The agent notes the absence of an open deal in the activity log note.

**`FOLLOW_UP_STAGE_FILTER` produces zero contacts** — the stage names in the env var must match exactly the stage strings stored in your CRM (case-sensitive). Run `crm_query contacts { limit: 5 }` to inspect actual stage values and align the filter.

**Draft quality is poor for unusual stages** — the drafting prompt uses deal stage as the primary signal. Custom stage names that are not standard labels (e.g. `"Eval-Round-2"`) may produce generic notes. Add stage-specific guidance to the agent prompt or rename stages to standard values.

**Approval queue grows faster than it is cleared** — reduce `MAX_CONTACTS_PER_RUN` or increase `FOLLOW_UP_DAYS` to lower the daily volume. Consider setting `REQUIRE_APPROVAL=false` and treating logged drafts as the output, reviewing them in the activity feed.

---

## Constraints

- This kit drafts and logs follow-up notes; it does not send emails or messages. Sending requires a separate integration (e.g. the outbound email kit).
- Contacts tagged `do-not-contact` are always skipped, regardless of other filters.
- Maximum 20 contacts per run by default. Raise `MAX_CONTACTS_PER_RUN` cautiously — each contact involves multiple CRM calls.
- The `[DRAFT]` prefix in the logged activity note is intentional; downstream integrations can filter on it.
- Works with both SQLite and Postgres Headless CRM backends.

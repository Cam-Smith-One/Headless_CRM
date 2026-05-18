# Churn Detection Kit

An agent workflow that monitors existing customers for early churn signals — inactivity, low engagement score, approaching contract end dates, and unrenewed deal values — then scores each account's churn risk 0–100, tags high-risk contacts, logs a risk assessment activity, and requests human approval to intervene on the accounts most likely to leave.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Fetches contacts tagged with `CUSTOMER_TAG` up to `MAX_ACCOUNTS_PER_RUN` at a time
2. For each customer, retrieves their latest activity, deal history, and stage history
3. Evaluates four churn signals: days since last activity, engagement score, contract end date proximity, and deal renewal status
4. Calculates a churn risk score 0–100 and writes it to `customFields.churnRisk`
5. Tags contacts above `CHURN_RISK_THRESHOLD` with `churn-risk`
6. Logs a risk-assessment activity with signal breakdown
7. Requests human approval for intervention on the highest-risk accounts
8. Delivers a ranked churn risk summary

Run on a weekly schedule or triggered on demand when a customer health review is needed.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed with operator or developer role
- Contacts must be tagged with `CUSTOMER_TAG` to be included
- Deals linked to contacts via `contactId` for renewal signal assessment

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Churn detection behaviour
CUSTOMER_TAG=customer                # tag identifying existing customers to monitor
INACTIVITY_DAYS=30                   # days without activity before flagging inactivity signal
CONTRACT_END_FIELD=contractEndDate   # customFields key holding the contract end date (ISO string)
CHURN_RISK_THRESHOLD=70              # risk score at/above which the churn-risk tag is applied
MAX_ACCOUNTS_PER_RUN=20             # cap per run to avoid timeouts
```

---

## Churn Risk Scoring Rubric

| Signal | Max points | How assessed |
|--------|-----------|--------------|
| Days since last activity | 30 | crm_recall / activity log; 30 pts if >= INACTIVITY_DAYS, scaled below |
| Engagement score | 25 | contact.score; 25 pts if score < 20, scaled up to score 60 |
| Contract end date proximity | 25 | customFields[CONTRACT_END_FIELD]; 25 pts if <= 30 days away, 15 pts if <= 60 days |
| No active renewal deal | 20 | crm_query deals; 20 pts if no open deal linked to contact |

Total is capped at 100. Scores are written to `contact.customFields.churnRisk`.

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Tag your existing customers

Ensure all active customer contacts carry the `CUSTOMER_TAG` (default: `customer`). You can bulk-tag from the CRM dashboard or run:

```
crm_query contacts { filters: { stage: "Customer" } }  → crm_update each with { tags: ["customer"] }
```

### 3. Set the contract end date field name

If your contacts store contract renewal dates in a custom field, set `CONTRACT_END_FIELD` to that field's key:

```
CONTRACT_END_FIELD=renewalDate
```

### 4. Run on demand or schedule

Ask your agent: *"Run churn detection on my customer accounts"*

Or add to your cron:

```json
{
  "schedule": "0 8 * * 1",
  "prompt": "Run churn detection across all customer accounts",
  "skill": "churn-detection"
}
```

---

## Workflow (what the agent does)

```
1. crm_query contacts {
     filters: { tags_includes: CUSTOMER_TAG },
     limit: MAX_ACCOUNTS_PER_RUN,
     sort: { updatedAt: "asc" }   // process least-recently-updated first
   }

   If zero contacts: report "No contacts found with tag CUSTOMER_TAG" and stop.

For each contact:
2. Gather signals:
   a. crm_recall { recordType: "contacts", recordId: <id>, query: "last activity" }
      → derive days since last activity
   b. Read contact.score → derive engagement score signal
   c. Read contact.customFields[CONTRACT_END_FIELD] → derive contract end proximity
   d. crm_query deals { filters: { contactId: <id>, stage_not: "Closed Won" } }
      → check for active renewal deal

3. Compute churn risk score 0–100 using rubric above

4. crm_update contacts/<id> {
     customFields: { churnRisk: <score> }
   }

5. If score >= CHURN_RISK_THRESHOLD:
   crm_update contacts/<id> { tags: [...existing, "churn-risk"] }

6. crm_log_activity {
     recordType: "contacts",
     recordId: <id>,
     type: "agent_action",
     note: "Churn risk assessed: <score>/100. Signals — Inactivity: <N> days; Score: <N>; Contract ends: <date|N/A>; Renewal deal: <yes|no>."
   }

7. If score >= CHURN_RISK_THRESHOLD:
   crm_request_approval {
     type: "bulk_operation",
     title: "Intervene on churn risk: <First Last> (<Company>) — risk <score>/100",
     requestedBy: "churn-detection",
     context: { contactId, score, signals: { inactivityDays, engagementScore, contractEndDate, hasRenewalDeal } }
   }

8. Sort results by risk score descending, deliver summary
```

---

## Output Summary Format

```
🔥 Churn Detection Run — 19 May 2026

Assessed 15 customer accounts

🚨 High risk (≥ 70) — 4 accounts:
  • Sarah Chen @ TechFlow — 91/100 (inactive 58d, no renewal deal, contract ends 12 Jun)
  • Marcus Johnson @ Nexus AI — 82/100 (inactive 44d, score 18/100)
  • Elena Volkov @ CloudBase — 77/100 (contract ends 5 Jun, no renewal deal)
  • James Park @ DataSynth — 70/100 (score 14/100, inactive 32d)

⚠️  Medium risk (40–69) — 6 accounts:
  • [Name] @ [Company] — [score]/100 ([top signal])
  [+ 5 more]

✅ Low risk (< 40) — 5 accounts

📋 4 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**No activity history found** — `crm_recall` returns nothing for the contact. The agent awards full inactivity points and notes "no activity history" in the risk log. This is a conservative default: better to flag and investigate than to miss a churning account.

**`CONTRACT_END_FIELD` not present in customFields** — the field is absent or null. The agent awards zero points for that signal and notes the missing field. Set `CONTRACT_END_FIELD` to the correct key or ensure customers have the field populated.

**Contact already tagged `churn-risk`** — the tag is not duplicated; the agent checks the existing tags array before appending. The activity log is still written to create an audit trail of repeated risk assessments.

**Bulk runs time out** — lower `MAX_ACCOUNTS_PER_RUN` to 10. The agent processes the oldest-updated contacts first, so subsequent runs pick up where the previous left off.

**False positives on new customers** — recently onboarded contacts have no activity yet and no renewal deal, producing artificially high scores. Filter them out by adding a minimum customer age check: contacts created within 60 days are skipped automatically when `INACTIVITY_DAYS` is set to 30.

---

## Constraints

- Only processes contacts with `CUSTOMER_TAG`. Contacts without this tag are never assessed.
- Churn risk scores are written to `customFields.churnRisk`. If your instance restricts custom field writes, the score is included in the activity note only.
- Does not take intervention actions directly — only requests approval. The human decides the intervention from the dashboard.
- `crm_recall` is used for activity lookback; if the runtime does not support it, `crm_query activities` is used as a fallback.
- Works with both SQLite and Postgres Headless CRM backends.

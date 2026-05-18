# Skill: Churn Detection

## Purpose

Assess existing customer accounts for churn risk by evaluating four signals — days since last activity, engagement score, contract end date proximity, and absence of a renewal deal — then score each account 0–100, tag high-risk contacts, log a risk assessment activity, and request human intervention approval on the most at-risk accounts.

## When to Use

- User asks to "check for churn risk", "assess customer health", or similar
- Weekly cron fires a customer health review
- A customer goes quiet and the user wants a risk snapshot
- User wants to identify which accounts need outreach before end of quarter

## Steps

### 1. Fetch customer contacts

```json
{
  "collection": "contacts",
  "filters": { "tags_includes": "CUSTOMER_TAG" },
  "limit": "MAX_ACCOUNTS_PER_RUN",
  "sort": { "updatedAt": "asc" }
}
```

Default `CUSTOMER_TAG`: `"customer"`. Default `MAX_ACCOUNTS_PER_RUN`: `20`.

If zero results: report "No contacts found with tag CUSTOMER_TAG" and stop.

### 2. For each contact — gather signals

**a. Inactivity signal**

Call `crm_recall` to find the most recent activity date:

```json
{
  "recordType": "contacts",
  "recordId": "<contactId>",
  "query": "last activity date"
}
```

Calculate `inactivityDays = today - lastActivityDate`. If no activity found, treat as `inactivityDays = 999`.

**b. Engagement score signal**

Read `contact.score`. If null, treat as `0`.

**c. Contract end date signal**

Read `contact.customFields[CONTRACT_END_FIELD]` (default key: `contractEndDate`). Parse as ISO date. Calculate `daysUntilContractEnd = contractEndDate - today`. If field is absent or null, treat as no signal (0 points).

**d. Renewal deal signal**

```json
{
  "collection": "deals",
  "filters": { "contactId": "<contactId>", "stage_not": "Closed Won" }
}
```

`hasRenewalDeal = results.length > 0`.

### 3. Compute churn risk score

Apply the rubric (max 100):

| Signal | Points awarded |
|--------|---------------|
| Inactivity | 30 if inactivityDays >= INACTIVITY_DAYS; scale linearly down to 0 at 0 days |
| Engagement | 25 if score < 20; 15 if score 20–39; 5 if score 40–59; 0 if score >= 60 |
| Contract proximity | 25 if daysUntilContractEnd <= 30; 15 if <= 60; 5 if <= 90; 0 otherwise |
| No renewal deal | 20 if hasRenewalDeal is false; 0 if true |

Cap total at 100.

### 4. Write risk score to custom field

```json
{
  "customFields": { "churnRisk": <0-100> }
}
```

### 5. Apply churn-risk tag (if above threshold)

If churn risk score >= `CHURN_RISK_THRESHOLD` (default: 70) and `"churn-risk"` is not already in `contact.tags`:

```json
{
  "tags": ["<existing tags>", "churn-risk"]
}
```

### 6. Log risk assessment activity

```json
{
  "recordType": "contacts",
  "recordId": "<contactId>",
  "type": "agent_action",
  "note": "Churn risk assessed: <score>/100. Signals — Inactivity: <N> days; Engagement score: <N>; Contract ends: <date|N/A>; Renewal deal: <yes|no>."
}
```

Always log this activity, even for low-risk accounts, to maintain an audit trail.

### 7. Request approval for high-risk accounts

If score >= `CHURN_RISK_THRESHOLD`:

```json
{
  "type": "bulk_operation",
  "title": "Intervene on churn risk: <First Last> (<company name>) — risk <score>/100",
  "requestedBy": "churn-detection",
  "context": {
    "contactId": "<id>",
    "churnRisk": <score>,
    "signals": {
      "inactivityDays": <N>,
      "engagementScore": <N>,
      "contractEndDate": "<date|null>",
      "hasRenewalDeal": <true|false>
    }
  }
}
```

### 8. Deliver summary

Sort all assessed accounts by churn risk descending. Format:

```
🔥 Churn Detection Run — [Date]

Assessed [N] customer accounts

🚨 High risk (≥ [CHURN_RISK_THRESHOLD]) — [N] accounts:
  • [Name] @ [Company] — [score]/100 ([top 2 signals])
  [max 5 shown, sorted by score desc]

⚠️  Medium risk (40–[threshold-1]) — [N] accounts:
  • [Name] @ [Company] — [score]/100 ([top signal])
  [max 5 shown]

✅ Low risk (< 40) — [N] accounts

📋 [N] approval requests created
```

Skip sections with zero accounts.

## Outputs

- `customFields.churnRisk` updated on each assessed contact
- `churn-risk` tag applied to contacts above threshold
- One `agent_action` activity per contact with signal breakdown
- One approval request per high-risk contact
- Console summary ranked by risk score

## Notes

- Never remove the `CUSTOMER_TAG` or any existing tags; only append `churn-risk`
- Never take intervention actions directly — only request approval
- If `crm_recall` is unavailable, fall back to `crm_query activities` filtered by recordId and sort by `createdAt desc, limit 1`
- A contact with no activity history is treated as maximally inactive (conservative default)
- Contacts created within the last 60 days may produce high false-positive scores; consider filtering by `createdAt_lt: <60 days ago>` in the initial query for your use case
- Requires operator or developer role on headless-crm-connect
- Works with both SQLite and Postgres Headless CRM backends

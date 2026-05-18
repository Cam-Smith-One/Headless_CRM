# Activity Summariser Kit

For any contact, company, or deal, queries all logged activities and generates a concise human-readable summary: relationship timeline, key milestones, last interaction, open items, and an overall relationship health score. Useful for onboarding a new team member onto an account, or getting up to speed before a call. Run entirely on demand.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

On demand, your agent:

1. Resolves the target record (contact, company, or deal) by name or ID
2. Fetches all logged activities up to `MAX_ACTIVITIES`
3. Optionally fetches deal history if `INCLUDE_DEAL_HISTORY=true`
4. Identifies key milestones: first contact, first meeting, proposal sent, deal created
5. Calculates a relationship health score (0–100) based on recency, frequency, and interaction type mix
6. Formats the summary in either `brief` (bullet points) or `detailed` (full narrative) style
7. Returns the summary to the conversation — no CRM writes

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
MAX_ACTIVITIES=50                  # max activities to fetch per record
SUMMARY_STYLE=brief                # "brief" (3–5 bullets) or "detailed" (full narrative)
INCLUDE_DEAL_HISTORY=true          # include deal stage history and deal records
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Configure output style

`SUMMARY_STYLE=brief` is recommended for pre-call prep (outputs in seconds, easy to scan).
`SUMMARY_STYLE=detailed` is better for account handover or onboarding a new rep.

Set `INCLUDE_DEAL_HISTORY=false` for contacts where deal context is not relevant (e.g. partners, vendors).

### 3. Run on demand

Ask your agent:
- *"Summarise my relationship with Sarah Kim"*
- *"Give me a summary of the Nexus AI account"*
- *"What's the history on deal d_abc123?"*
- *"Get me up to speed on Acme Corp before my call"*

---

## Workflow (what the agent does)

```
1. Resolve record:
   crm_search { query: "[name or ID]", collections: ["contacts","companies","deals"] }
   → identify record type and ID
   If ID provided directly:
   crm_get { collection: "[type]", id: "[id]" }

2. Fetch activities:
   crm_query { collection: "activities",
     filters: { [recordType + "Id"]: record.id },
     limit: MAX_ACTIVITIES,
     sort: "createdAt_asc" }

3. If record is a company:
   crm_query { collection: "contacts", filters: { companyId: record.id }, limit: 20 }
   → fetch activities for each contact (up to MAX_ACTIVITIES total across all)

4. If INCLUDE_DEAL_HISTORY=true and record is contact or company:
   crm_query { collection: "deals",
     filters: { [contactId or companyId]: record.id }, limit: 20 }
   → for each deal: crm_stage_history { dealId: deal.id }

5. Build relationship timeline:
   → First activity (date + type)
   → First meeting or call (date)
   → Any proposal_draft activities (date)
   → Most recent activity (date + type + note snippet)
   → Open items: activities with type "task" or "follow_up" and no completion date

6. Calculate health score (0–100):
   recency_score    = max(0, 100 − (days_since_last_activity × 3))   [max 40 pts]
   frequency_score  = min(40, total_activities × 2)                   [max 40 pts]
   diversity_score  = unique_activity_types × 5                       [max 20 pts]
   health = recency_score + frequency_score + diversity_score

7. Format summary based on SUMMARY_STYLE:
   "brief"    → 3–5 bullet points
   "detailed" → full narrative with sections

8. Return to conversation (no CRM writes)
```

---

## Output Summary Format

**Brief style:**

```
📋 Nexus AI — Relationship Summary

Contact: Sarah Kim (sarah@nexusai.com) · Score: 78
Last interaction: 15 May — email re: pricing (3 days ago)

• First contact: 2 Apr via inbound form
• 14 activities logged: 6 emails, 3 calls, 2 meetings, 3 notes
• Proposal draft sent 10 May — no response yet
• Open item: follow-up on security questionnaire (logged 12 May)

🟢 Health Score: 74/100 — Active relationship, respond to open item
```

**Detailed style:**

```
📋 Nexus AI — Full Relationship Summary

Contact: Sarah Kim, Head of Operations
Email: sarah@nexusai.com · CRM Score: 78 · Stage: Proposal

── Relationship Timeline ──────────────────────────────────

2 Apr   Inbound enquiry via website form — expressed interest in
        the reporting module for a 40-person ops team.

8 Apr   Discovery call (35 min) — Sarah confirmed pain around
        manual weekly reporting. No current tool in use.

14 Apr  Demo delivered — positive reaction to dashboard builder.
        Asked about API access and SSO.

22 Apr  Proposal draft generated · $30,000 · Pro tier

10 May  Proposal sent (email) — followed up on custom SSO pricing.

12 May  Follow-up note logged: security questionnaire outstanding.
        Sarah acknowledged, no response yet.

15 May  Email from Sarah re: pricing — asked if annual discount available.

── Open Items ──────────────────────────────────────────────

• Security questionnaire response (outstanding since 12 May)
• Annual discount question raised 15 May — not yet answered

── Deals ───────────────────────────────────────────────────

• Nexus AI — Pro Plan · $30,000 · Proposal stage · 26 days in pipeline

── Health Score: 74/100 ─────────────────────────────────────

Recency: 30/40 (last contact 3 days ago)
Frequency: 28/40 (14 activities)
Diversity: 15/20 (4 activity types)

Status: Active relationship. Priority action: answer the annual
pricing question and chase the security questionnaire.
```

---

## Failure Patterns and Mitigations

**Record not found by name** — try a more specific search (full company name, email address, or deal ID). If search returns multiple matches, the agent will ask you to confirm.

**Activities return empty** — the record exists but no activities have been logged yet. The summary will note this rather than failing.

**Company summary takes too long** — companies with many contacts can trigger many activity queries. Reduce `MAX_ACTIVITIES` or set `INCLUDE_DEAL_HISTORY=false` for company-level summaries.

**Health score seems wrong** — the score is based on recency, frequency, and diversity of activity types. If your team logs activities sporadically, the score will skew low even for healthy accounts. It is a signal, not a definitive assessment.

**Deal history missing** — `crm_stage_history` may return empty for deals without explicit stage transitions. The deal record will still appear; only the per-stage timeline is omitted.

---

## Constraints

- Read-only. This kit never writes to the CRM.
- Fetches up to `MAX_ACTIVITIES` (default 50) activities. For high-activity accounts, the most recent 50 are used; increase the limit for full history.
- `SUMMARY_STYLE=detailed` produces longer output. For very busy accounts (50+ activities) this may be verbose — `brief` is recommended for quick pre-call prep.
- Company-level summaries aggregate activities across all linked contacts. Total fetch count is still capped at `MAX_ACTIVITIES`.
- The health score is a heuristic, not a ML model. Calibrate `MAX_ACTIVITIES` and assess the formula against your team's activity logging habits.

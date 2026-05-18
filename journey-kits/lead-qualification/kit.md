# Lead Qualification Kit

An agent workflow that picks up new or unscored contacts from Headless CRM, researches each one, scores them against your criteria, updates the CRM, and optionally requests human approval before advancing high-value leads to the next stage.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** onezeroten  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** onezeroten/headless-crm-connect

---

## What It Does

1. Queries contacts where `score` is null or below a configurable threshold
2. For each contact, researches the company (web search or enrichment API)
3. Scores the lead against your `ICP_CRITERIA` (configurable)
4. Updates the contact's score, adds tags, and logs a qualification activity
5. For leads scoring above `AUTO_ADVANCE_THRESHOLD`: requests human approval to move the deal to the next stage
6. Delivers a qualification summary

Run on demand, on a schedule, or triggered when new contacts are created via webhook.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and operator (or developer) role
- Web search access (built-in to Claude Code) or Exa/Tavily API for research
- Optional: enrichment API key (Clearbit, Apollo, etc.)

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Qualification behaviour
ICP_CRITERIA=B2B SaaS company, 10-500 employees, Series A or B, engineering-led
SCORE_THRESHOLD=60                   # only process contacts scoring below this
AUTO_ADVANCE_THRESHOLD=80            # request approval for leads at/above this score
MAX_CONTACTS_PER_RUN=20             # cap to avoid long runs
QUALIFICATION_TAG=qualified          # tag applied to qualifying leads

# Research (optional — improves accuracy)
EXA_API_KEY=                         # Exa neural search for company research
TAVILY_API_KEY=                      # Tavily alternative
```

---

## Scoring Rubric

The agent scores each lead 0–100 based on:

| Signal | Max points | How assessed |
|--------|-----------|--------------|
| Company size matches ICP | 25 | From research / enrichment |
| Industry / vertical match | 20 | From company domain + research |
| Funding stage match | 20 | From research |
| Contact title / seniority | 20 | From contact record |
| Recent activity signal | 15 | Email opened, replied, website visit |

Scores are written to `contact.score` (integer 0–100).

Adjust the rubric by editing `ICP_CRITERIA` — the agent uses it as context when scoring.

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Set ICP criteria

Edit `ICP_CRITERIA` to describe your ideal customer:
```
B2B SaaS, 10–200 employees, Series A or B, engineering-led team,
headquartered in US or EU, annual contract value potential $10k+
```

### 3. Run on demand

Ask your agent: *"Qualify the unscored leads in my CRM"*

Or trigger automatically by adding to your cron:
```json
{
  "schedule": "0 9 * * 1-5",
  "prompt": "Run lead qualification for any new unscored contacts",
  "skill": "lead-qualification"
}
```

---

## Workflow (what the agent does)

```
1. crm_query contacts { filters: { score: null }, limit: MAX_CONTACTS_PER_RUN }
   + crm_query contacts { filters: { score_lt: SCORE_THRESHOLD }, limit: MAX_CONTACTS_PER_RUN }

For each contact:
2. Look up company: crm_get companies/<companyId>
3. Research company online (web search or Exa/Tavily)
4. Score contact 0–100 against ICP_CRITERIA
5. crm_update contacts/<id> { score: N, stage: "Qualified" (if score >= 60) }
6. crm_log_activity { type: "agent_action", note: "Scored [N]/100 — [reasoning]" }
7. If score >= AUTO_ADVANCE_THRESHOLD:
   crm_request_approval {
     type: "bulk_operation",
     title: "Advance [name] to Proposal stage — score [N]/100",
     context: { contactId, score, reasoning }
   }
8. Apply QUALIFICATION_TAG if score >= SCORE_THRESHOLD

9. Deliver summary: N contacts processed, N qualified, N sent for approval
```

---

## Output Summary Format

```
🎯 Lead Qualification Run — 19 May 2026

Processed 12 contacts in 47 seconds

✅ Qualified (score ≥ 60): 7
  • Sarah Chen @ TechFlow — 87/100 (approval requested)
  • Marcus Johnson @ Nexus AI — 82/100 (approval requested)
  • Elena Volkov @ CloudBase — 74/100
  [+ 4 more]

❌ Did not qualify (score < 60): 5
  • James Park @ DataSynth — 42/100 (wrong vertical)
  [+ 4 more]

📋 2 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**Research returns nothing** — the contact has no company attached (`companyId` is null). The agent scores based on contact fields only and notes the limitation in the activity log.

**Rate limiting on web search** — if researching many contacts, the agent adds a brief pause between calls. Set `MAX_CONTACTS_PER_RUN=5` for slower, more thorough research.

**Score is inconsistent between runs** — add more specific `ICP_CRITERIA`. Vague criteria ("good fit") produce variable scores. Specific criteria ("B2B SaaS, 10–200 employees, Series A") are consistent.

**Approval spam** — if too many leads hit `AUTO_ADVANCE_THRESHOLD`, raise the threshold or lower `MAX_CONTACTS_PER_RUN`.

---

## Constraints

- Max 20 contacts per run by default. Raise `MAX_CONTACTS_PER_RUN` cautiously — web research per contact takes 3–10 seconds.
- Scores are integers 0–100 written to `contact.score`. If you use a different field for scoring, update the queries.
- This kit does not advance deal stages automatically — it only requests approval. The human approves in the dashboard.
- Works with both SQLite and Postgres Headless CRM backends.

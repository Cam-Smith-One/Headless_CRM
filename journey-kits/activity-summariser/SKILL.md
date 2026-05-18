# Skill: Activity Summariser

## Purpose

For any contact, company, or deal, fetch all logged activities and produce a concise human-readable summary: relationship timeline, key milestones, last interaction, open items, and a relationship health score. Read-only. No CRM writes.

## When to Use

- When the user asks to "summarise my relationship with [person/company]", "get me up to speed on [account]", or "what's the history on [deal]"
- When a rep asks "what happened with [contact] before my call?"
- When onboarding a new team member onto an account
- When the user provides a contact name, company name, or deal ID and asks for a summary

## Steps

### 1. Resolve the target record

**If a name is provided:**
```json
{ "tool": "crm_search", "query": "[name]", "collections": ["contacts", "companies", "deals"] }
```
Identify the record type (contact / company / deal) and its ID. If multiple matches are returned, ask the user to confirm before continuing.

**If an ID is provided:**
```json
{ "tool": "crm_get", "collection": "[contacts|companies|deals]", "id": "[id]" }
```

### 2. Fetch activities

Use the appropriate ID field for the filter based on record type:

| Record type | Filter field |
|-------------|-------------|
| contact | `contactId` |
| company | `companyId` |
| deal | `dealId` |

```json
{ "collection": "activities", "filters": { "[field]": "[id]" }, "limit": 50, "sort": "createdAt_asc" }
```

Use `MAX_ACTIVITIES` (default 50) as the limit.

**For company records:** also fetch linked contacts, then fetch activities for each contact. Merge and de-duplicate by activity ID. Still cap total at `MAX_ACTIVITIES`.

```json
{ "collection": "contacts", "filters": { "companyId": "[company.id]" }, "limit": 20 }
```

### 3. Fetch deal history (if INCLUDE_DEAL_HISTORY=true)

If the record is a contact or company, fetch linked deals:

```json
{ "collection": "deals", "filters": { "[contactId|companyId]": "[id]" }, "limit": 20 }
```

For each deal, call:
```json
{ "tool": "crm_stage_history", "dealId": "[deal.id]" }
```

### 4. Build the relationship timeline

From the sorted activity list, identify:
- **First activity**: earliest `createdAt`, type, and note snippet
- **First call or meeting**: first activity with `type` of `call` or `meeting`
- **Proposal milestone**: first activity with `type` of `proposal_draft` or `proposal_sent`
- **Last activity**: most recent `createdAt`, type, and note snippet (max 100 chars)
- **Open items**: activities with `type` of `task` or `follow_up` that have no `completedAt` field

### 5. Calculate health score

```
recency_score    = max(0, 100 − (days_since_last_activity × 3))  → cap at 40
frequency_score  = min(40, total_activities × 2)                  → cap at 40
diversity_score  = count_of_unique_activity_types × 5             → cap at 20
health_score     = recency_score + frequency_score + diversity_score
```

Score bands:
- 80–100 → 🟢 Highly active relationship
- 50–79 → 🟡 Active relationship
- 20–49 → 🟠 Cooling — consider re-engagement
- 0–19 → 🔴 Dormant — no recent contact

### 6. Format the summary

**If `SUMMARY_STYLE=brief` (default):**

```
📋 [Record Name] — Relationship Summary

[Contact name and email if contact] · Score: [CRM score if available]
Last interaction: [date] — [activity type] [note snippet] ([N] days ago)

• First contact: [date] via [type]
• [N] activities logged: [breakdown by type]
• [Proposal milestone if exists]
• Open item: [task/follow-up note] (logged [date]) — [omit if none]

[Health band emoji] Health Score: [N]/100 — [band label][, one-line priority action if score < 80]
```

**If `SUMMARY_STYLE=detailed`:**

Produce a full narrative with these sections:
1. **Header block** — record name, contact details, CRM score, current deal stage if applicable
2. **Relationship Timeline** — one line per milestone and key activity, sorted chronologically
3. **Open Items** — bulleted list of unresolved tasks/follow-ups (omit section if none)
4. **Deals** — deal name, value, stage, and days in pipeline for each linked deal (omit section if `INCLUDE_DEAL_HISTORY=false` or no deals)
5. **Health Score** — breakdown by component (recency/frequency/diversity) plus status label and one-line recommended action

Rules for both styles:
- Omit any section where the data is empty — never write "None" or "N/A"
- Dates are formatted as "D Mon" (e.g. "2 Apr")
- Activity type breakdowns use plain names: email, call, meeting, note, task
- Note snippets are truncated at 80 characters with "…" if longer

### 7. Return to conversation

Present the formatted summary. State clearly it is read-only: "No changes were made to your CRM."

## Outputs

- A formatted relationship summary in `brief` or `detailed` style, returned to the conversation
- No CRM writes

## Notes

- This skill is entirely read-only
- If no activities are found, return a summary noting the record exists but has no logged activity — do not error
- If `crm_stage_history` errors for a deal, include the deal record but omit per-stage timeline
- Requires `headless-crm-connect` kit installed and `crm_*` tools available
- Works with both SQLite and Postgres Headless CRM backends

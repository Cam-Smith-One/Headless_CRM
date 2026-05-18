# Meeting Prep Kit

An agent workflow that takes a contact name or email, pulls their full CRM record along with their company, open deals, recent activities, and pending approvals, and generates a concise pre-meeting brief covering who they are, where the deal stands, recent interaction history, open items, and suggested talking points.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Resolves the contact from a name or email using `crm_search` or `crm_recall`
2. Retrieves the full contact record, company record, and all open deals for that contact
3. Fetches the `BRIEF_MAX_ACTIVITIES` most recent activities across the contact and their deals
4. Retrieves any pending approval requests linked to the contact or deals
5. Optionally enriches the company with public research if `INCLUDE_COMPANY_RESEARCH` is true
6. Generates a structured pre-meeting brief: identity, deal status, interaction history, open items, talking points
7. Logs a `meeting_prep` activity on the contact to record that a brief was generated

Run on demand before any call or meeting.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and viewer role or above (no writes required except the prep log)
- Web search access (built-in) is used only when `INCLUDE_COMPANY_RESEARCH=true`

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Brief behaviour
BRIEF_MAX_ACTIVITIES=10          # number of recent activities to include in the brief
INCLUDE_COMPANY_RESEARCH=true    # enrich company with a quick web search for recent news
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Run on demand

Ask your agent before any call:

*"Prep me for my meeting with Sarah Chen"*  
*"Give me a brief on the Acme Corp account"*  
*"Meeting prep for sarah@techflow.io"*

No scheduling required — this kit is always run on demand.

---

## Workflow (what the agent does)

```
1. Parse input — extract name or email from the user's request

2. Resolve contact:
   If email provided:   crm_search { query: "<email>", collection: "contacts" }
   If name provided:    crm_search { query: "<name>",  collection: "contacts" }
   If ambiguous:        present top 3 matches and ask user to confirm
   Fallback:            crm_recall { query: "<name or email>" }

3. crm_get contacts/<contactId>
   crm_get companies/<contact.companyId>   (if companyId is set)

4. crm_query deals { filters: { contactId: contact.id }, limit: 10 }
   → separate into open deals and closed deals

5. crm_query activities {
     filters: { recordType: "contacts", recordId: contact.id },
     sort:    { field: "createdAt", order: "desc" },
     limit:   BRIEF_MAX_ACTIVITIES
   }
   Also fetch activities for each open deal (same pattern, merge and re-sort by date desc)

6. crm_query approvals {
     filters: { status: "pending", context_contactId: contact.id }
   }
   Also check for pending approvals on each open deal

7. If INCLUDE_COMPANY_RESEARCH = true and companyId is set:
   Web search for "[company name] news site:techcrunch.com OR site:linkedin.com OR site:crunchbase.com"
   Extract: recent funding, headcount changes, product launches, leadership changes

8. Generate brief (see Output Summary Format)

9. crm_log_activity {
     recordType: "contacts", recordId: contact.id,
     type: "meeting_prep",
     note: "Pre-meeting brief generated. Open deals: [N]. Last activity: [type] on [date]."
   }
```

---

## Output Summary Format

```
📋 Meeting Brief — Sarah Chen @ TechFlow
   Prepared 19 May 2026 · 08:42

━━ WHO THEY ARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sarah Chen — Head of Engineering
TechFlow Inc · Series B · ~120 employees · San Francisco
sarah@techflow.io · Score: 87/100 · Tags: qualified, champion

━━ DEAL STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enterprise Licence — $48,000
Stage: Negotiation · Expected close: 23 May 2026 · Pipeline: Enterprise
Deal open for 34 days · 6 days in current stage

━━ RECENT INTERACTIONS (last 10) ━━━━━━━━━━
19 May  email       "Following up on revised pricing…"
15 May  call        "Discussed security review requirements, SOC2 report requested"
10 May  email       "Sent proposal v2 with volume discount"
07 May  agent_action "Lead scored 87/100 — strong ICP match, engineering-led"
[+ 6 more in CRM]

━━ OPEN ITEMS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Approval pending: Advance to Closed Won — waiting since 18 May
• SOC2 report was requested on 15 May — confirm if sent

━━ COMPANY INTEL ━━━━━━━━━━━━━━━━━━━━━━━━━━
(from web research)
TechFlow raised $22M Series B in March 2026 (TechCrunch). Currently hiring 3 senior
engineers. No recent leadership changes. Competing product Streamline announced pricing
increase last week — potential urgency signal.

━━ SUGGESTED TALKING POINTS ━━━━━━━━━━━━━━━
1. Close the SOC2 loop — did they receive the report? Is it blocking sign-off?
2. Reference the Streamline pricing increase — positioning window.
3. Approval is pending on our side too — confirm decision-maker timeline.
4. Ask about Sarah's internal champion coverage — does her VP know the deal?
```

---

## Failure Patterns and Mitigations

**Contact not found by name** — the agent presents the top 3 search results and asks the user to confirm before proceeding. If zero results, it asks for the contact's email as a fallback.

**Multiple contacts match the name** — same as above: list matches with company and email, ask user to select. Never proceed ambiguously.

**No activities on record** — the brief notes "No activities logged" in the interactions section and omits that block. The talking points section adapts to reflect that this may be an early-stage or re-engaged contact.

**Company research returns irrelevant results** — the web search result is summarised as-is; the agent notes low confidence if the company name is generic or the search returned no relevant results. Set `INCLUDE_COMPANY_RESEARCH=false` to skip this step entirely.

**Contact has no open deals** — the Deal Status block is replaced with "No open deals. Most recent closed deal: [name] ([stage] on [date])." Talking points are generated from company and activity history instead.

---

## Constraints

- This kit is read-only except for the `meeting_prep` activity log entry.
- Run on demand only — scheduling a meeting prep brief without a named contact produces no useful output.
- `BRIEF_MAX_ACTIVITIES` applies across contact and deal activities combined; the most recent N across all sources are included.
- Company research is best-effort and uses public sources only. Do not treat it as authoritative; verify critical details before the meeting.
- Works with both SQLite and Postgres Headless CRM backends.

# Skill: Meeting Prep

## Purpose

Given a contact name or email, pull their full CRM record, open deals, recent activity history, and pending approvals, optionally enrich the company with public research, and generate a structured pre-meeting brief with identity, deal status, interaction history, open items, and suggested talking points.

## When to Use

Run this skill whenever the user says they have a call, meeting, or demo coming up and wants context on the person or account. Triggers include "prep me for", "brief on", "before my call with", or any mention of a contact name paired with an upcoming meeting. Do not run on a schedule — this skill is always invoked on demand with a specific contact as the subject.

## Steps

1. **Resolve the contact**
   - If the input contains `@`, treat it as an email: call `crm_search` with `{ "query": "<email>", "collection": "contacts" }`.
   - Otherwise, treat it as a name: call `crm_search` with `{ "query": "<name>", "collection": "contacts" }`.
   - If `crm_search` returns zero results, call `crm_recall` with `{ "query": "<input>" }`.
   - If multiple contacts match: list the top 3 with name, company, and email, then ask the user to confirm before continuing. Never proceed with an ambiguous match.
   - If still no match: ask the user for the contact's email address.

2. **Fetch core records**
   - `crm_get` for the contact: `contacts/<contactId>`
   - If `contact.companyId` is set: `crm_get` for `companies/<companyId>`

3. **Fetch deals**
   Call `crm_query` with `{ "collection": "deals", "filters": { "contactId": "<contactId>" }, "limit": 10 }`.
   Separate results into open deals (stage not in `["Closed Won", "Closed Lost"]`) and closed deals. Use the most recent open deal as the primary deal for the brief.

4. **Fetch recent activities**
   Call `crm_query` for contact activities:
   ```json
   {
     "collection": "activities",
     "filters": { "recordType": "contacts", "recordId": "<contactId>" },
     "sort": { "field": "createdAt", "order": "desc" },
     "limit": 10
   }
   ```
   For the primary open deal (if any), call the same query with `"recordType": "deals"` and `"recordId": "<dealId>"`.
   Merge both result sets, sort by `createdAt` descending, and keep the top `BRIEF_MAX_ACTIVITIES` (default 10).

5. **Fetch pending approvals**
   Call `crm_query` for approvals linked to the contact and to each open deal:
   ```json
   { "collection": "approvals", "filters": { "status": "pending", "context_contactId": "<contactId>" } }
   ```
   Collect any pending items for the Open Items section.

6. **Enrich company (if INCLUDE_COMPANY_RESEARCH is true)**
   Run a web search for `"<company name>" funding OR hiring OR news` restricted to `site:techcrunch.com OR site:linkedin.com OR site:crunchbase.com`.
   Extract up to three relevant signals: recent funding, headcount changes, product launches, leadership changes, competitor news. If the search returns nothing relevant, note low confidence and omit the section.

7. **Generate the brief**
   Produce the brief in this exact structure:

   ```
   📋 Meeting Brief — <First Last> @ <Company>
      Prepared <DD Mon YYYY> · <HH:MM>

   ━━ WHO THEY ARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   <Full name> — <title if known>
   <Company> · <funding stage if known> · <headcount if known> · <location if known>
   <email> · Score: <score>/100 · Tags: <tags>

   ━━ DEAL STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   <deal.name> — $<value>
   Stage: <stage> · Expected close: <date> · Pipeline: <pipelineId>
   Deal open for <N> days · <N> days in current stage

   ━━ RECENT INTERACTIONS (last <N>) ━━━━━━━━━━
   <date>  <type>  "<first 80 chars of note>…"
   [one line per activity, newest first]

   ━━ OPEN ITEMS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [bullet per pending approval or unresolved item from activities]

   ━━ COMPANY INTEL ━━━━━━━━━━━━━━━━━━━━━━━━━━
   [2–4 sentences from web research, or omit if INCLUDE_COMPANY_RESEARCH=false]

   ━━ SUGGESTED TALKING POINTS ━━━━━━━━━━━━━━━
   1. <specific, actionable point grounded in the data above>
   2. <...>
   3. <...>
   4. <...>
   ```

   Omit any section that has no data (e.g. no open items, no company data). Talking points must be specific to this contact and deal — no generic filler.

8. **Log the prep activity**
   ```json
   {
     "recordType": "contacts",
     "recordId": "<contactId>",
     "type": "meeting_prep",
     "note": "Pre-meeting brief generated. Open deals: <N>. Last activity: <type> on <date>."
   }
   ```

## Outputs

- Pre-meeting brief printed to the conversation (structured text, copy-ready)
- `meeting_prep` activity entry logged on the contact record

## Notes

- This skill is read-only except for the single `meeting_prep` log entry
- Never modify contact, deal, or company records during a prep run
- If the contact has no open deals, replace the Deal Status block with the most recently closed deal and note its outcome
- If the contact has zero logged activities, note this explicitly — it may mean the relationship is new or data entry is incomplete
- Suggested talking points must be grounded in actual CRM data; do not invent context
- Requires at minimum viewer role on the CRM tenant (operator role needed only for the log activity call)

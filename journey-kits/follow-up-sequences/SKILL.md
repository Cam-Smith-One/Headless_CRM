# Skill: Follow-Up Sequences

## Purpose

Find contacts and deals with no recent activity, draft a personalised follow-up note for each based on their deal stage and last interaction type, log it as a `follow_up` activity, and optionally request human approval before the note is treated as send-ready.

## When to Use

Run this skill when the user asks to find contacts that need outreach, draft follow-ups for a cold pipeline, or keep deals warm after a period of silence. Do not run it when the user wants to send a message immediately — this skill drafts and logs only. Do not process contacts tagged `do-not-contact` under any circumstances.

## Steps

1. **Build the contact query**
   Parse `FOLLOW_UP_STAGE_FILTER` (comma-separated, trim whitespace). If non-empty, call:
   ```json
   { "collection": "contacts", "filters": { "stage_in": ["<stage1>", "<stage2>"] }, "limit": 20 }
   ```
   If empty, call without a stage filter (limit still applies via `MAX_CONTACTS_PER_RUN`, default 20).

2. **Skip do-not-contact contacts**
   For each contact returned, check `tags`. If `"do-not-contact"` is present, skip immediately — do not log, do not draft.

3. **Determine last activity date**
   Call `crm_query` for the most recent activity on this contact:
   ```json
   {
     "collection": "activities",
     "filters": { "recordType": "contacts", "recordId": "<contactId>" },
     "sort": { "field": "createdAt", "order": "desc" },
     "limit": 1
   }
   ```
   - If an activity exists, `last_activity_date` = `activity.createdAt`.
   - If no activities exist, `last_activity_date` = `contact.createdAt`.
   Compute `days_since` = today minus `last_activity_date`.
   Skip the contact if `days_since < FOLLOW_UP_DAYS` (default 5).

4. **Get deal and company context**
   - Call `crm_query` to find the contact's open deal: `{ "collection": "deals", "filters": { "contactId": "<id>", "stage_not_in": ["Closed Won", "Closed Lost"] }, "limit": 1 }`.
   - If `contact.companyId` is set, call `crm_get` for the company record.

5. **Draft the follow-up note**
   Use contact name, company name, `deal.stage`, `deal.name`, and the last activity `type` + first 100 characters of its `note` as context. Write a warm, concise follow-up of one to three sentences. Match tone to stage:
   - **Discovery / Qualified** — reference the problem or evaluation criteria discussed; ask if anything has changed.
   - **Proposal** — reference the proposal; ask about blockers or next steps.
   - **Negotiation** — reference outstanding terms; offer a call to move forward.
   - **No open deal** — reference the last interaction; ask about current priorities.
   Avoid hollow openers ("I hope you're well", "Just checking in").

6. **Log the draft as an activity**
   ```json
   {
     "recordType": "contacts",
     "recordId": "<contactId>",
     "type": "follow_up",
     "note": "[DRAFT] <follow-up note text>"
   }
   ```

7. **Request approval if REQUIRE_APPROVAL is true**
   ```json
   {
     "type": "outreach",
     "title": "Send follow-up to <First Last> (<Company>) — <N> days since last contact",
     "requestedBy": "follow-up-sequences agent",
     "context": {
       "contactId": "<id>",
       "dealId": "<id or null>",
       "daysOverdue": <number>,
       "draftNote": "<note text>"
     }
   }
   ```

8. **Deliver summary**
   ```
   📬 Follow-Up Sequences — [Date]

   Contacts evaluated: [N]   Skipped (do-not-contact): [N]   Below FOLLOW_UP_DAYS: [N]

   ✉️  Drafted follow-ups: [N]

     [rank]. [First Last] @ [Company]  ([stage] — [N] days overdue)
          Draft: "[first 80 chars of note]…"
          → [Approval requested / No approval required]

   📋 [N] approval requests created → http://localhost:3000/approvals
   ```
   Omit the approval line if `REQUIRE_APPROVAL=false`. Show up to 5 entries inline; note how many more were drafted.

## Outputs

- `follow_up` activity entries (prefixed `[DRAFT]`) logged on each eligible contact
- Approval requests (one per drafted note, when `REQUIRE_APPROVAL=true`)
- Run summary printed to the conversation

## Notes

- Always skip contacts tagged `do-not-contact` — this check must happen before any CRM write
- Never send messages directly — this skill drafts and logs only
- If `crm_query` for activities fails for a contact, fall back to `contact.updatedAt` as the last-activity proxy and note the fallback in the log entry
- If no open deal is found, draft without stage context and note "no open deal" in the activity log
- Requires operator or developer role on the CRM tenant

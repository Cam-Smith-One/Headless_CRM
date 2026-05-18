# Skill: Deal Closer

## Purpose

Scan all active deals, identify those closing soon or stalled in a stage, rank them by urgency, log activity on each flagged deal, and optionally request human approval to advance or close them.

## When to Use

Run this skill when the user asks to review deals that need attention, surface pipeline risk, or generate a pre-stand-up action list. Also used on a scheduled morning cadence. Do not run it against already-closed deals or when the user is asking about a single specific deal — use `crm_get` for that.

## Steps

1. **Fetch active deals**
   Call `crm_query` with `{ "collection": "deals", "filters": { "stage_not_in": ["Closed Won", "Closed Lost"] }, "limit": 200 }`.
   Filter the result set to exclude deals where `value < MIN_DEAL_VALUE` (default 0).
   If zero deals remain, report "No active deals found" and stop.

2. **Check stage history for each deal**
   Call `crm_stage_history` with `{ "recordType": "deals", "recordId": "<deal.id>" }`.
   Compute `days_in_current_stage` = today minus the date of the most recent stage-change entry.
   If stage history is empty, mark `days_in_current_stage` as unknown.

3. **Classify each deal**
   - `CLOSING_SOON`: `expectedCloseDate` is non-null and is within `CLOSE_WINDOW_DAYS` days from today (or is already past).
   - `STALLED`: `days_in_current_stage` >= `STALE_THRESHOLD_DAYS`.
   - Skip deals that are neither. Do not log activity on skipped deals.

4. **Log activity on flagged deals**
   For each CLOSING_SOON or STALLED deal, call `crm_log_activity`:
   ```json
   {
     "recordType": "deals",
     "recordId": "<deal.id>",
     "type": "agent_action",
     "note": "Deal flagged by deal-closer: <CLOSING_SOON: closes DD Mon YYYY / STALLED: N days in <stage>>. Review and advance."
   }
   ```

5. **Request approval if AUTO_REQUEST_APPROVAL is true**
   Call `crm_request_approval` for each flagged deal:
   ```json
   {
     "type": "deal_advance",
     "title": "Review <deal.name> — <CLOSING_SOON: closes DD Mon / STALLED: N days in <stage>>",
     "requestedBy": "deal-closer agent",
     "context": {
       "dealId": "<id>",
       "value": <number>,
       "stage": "<stage>",
       "daysToClose": <number or null>,
       "daysInStage": <number or "unknown">
     }
   }
   ```

6. **Rank by urgency**
   Compute `urgency_score` for each flagged deal:
   `urgency_score = (1 / max(daysToClose, 1)) * 1000 + (daysInStage * 10) + (value / 10000)`
   For deals with unknown `daysInStage`, use 0 for that term.
   Sort flagged deals by `urgency_score` descending.

7. **Deliver summary**
   Output the prioritised list in this format:
   ```
   🚨 Deal Closer — [Date]

   Active deals scanned: [N]   Flagged: [N]   Below MIN_DEAL_VALUE: [N]

   🔴 Closing Soon (within [CLOSE_WINDOW_DAYS] days)
     [rank]. [Company] — [deal.name]   $[value]   closes [date]  (Stage: [stage])

   🟡 Stalled (no stage movement in ≥ [STALE_THRESHOLD_DAYS] days)
     [rank]. [Company] — [deal.name]   $[value]   [N] days in [stage]

   📋 [N] approval requests created → http://localhost:3000/approvals
   ```
   Omit a section entirely if it has zero items. Omit the approval line if `AUTO_REQUEST_APPROVAL=false`.

## Outputs

- Activity log entries on each flagged deal
- Approval requests (one per flagged deal, when `AUTO_REQUEST_APPROVAL=true`)
- Prioritised urgency-ranked summary printed to the conversation

## Notes

- Never advance deal stages directly — only request approval
- Never modify `expectedCloseDate` or `value` fields
- If `crm_stage_history` fails for a deal, treat `days_in_current_stage` as unknown, note it in the activity log, and continue
- Deals with `expectedCloseDate` in the past are treated as maximum urgency (overdue)
- Requires operator or developer role on the CRM tenant

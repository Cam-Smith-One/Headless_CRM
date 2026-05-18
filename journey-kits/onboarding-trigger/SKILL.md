# Skill: Onboarding Trigger

## Purpose

Detect deals that have just moved to "Closed Won" (or a configured equivalent stage) and automatically kick off a customer onboarding sequence: tag the linked contact, create follow-up task activities, log a welcome entry, and optionally request human approval before the first message is sent.

## When to Use

- User asks to "run onboarding for newly closed deals" or similar
- Scheduled cron fires (e.g. hourly) to catch stage changes
- Webhook event signals a deal stage change to the closed-won value
- User wants to confirm all Closed Won deals from the last N hours have had onboarding initiated

## Steps

### 1. Find newly closed deals

Query deals updated in the last `LOOKBACK_HOURS` (default: 24) that match `CLOSED_WON_STAGE`:

```json
{
  "collection": "deals",
  "filters": { "stage": "CLOSED_WON_STAGE", "updatedAt_gte": "<ISO timestamp>" },
  "limit": 50
}
```

If zero results: report "No newly closed deals found in the last LOOKBACK_HOURS hours" and stop.

### 2. For each deal — check for duplicate run

Call `crm_stage_history` or `crm_query` activities for the deal. If an activity with `type: "agent_action"` and note starting with "Onboarding sequence initiated" already exists, skip this deal and note it as "already processed" in the summary.

### 3. Fetch the linked contact

```json
{ "id": "<deal.contactId>" }
```

If `contactId` is null: log a warning activity on the deal, skip the tag step, continue to task creation.

### 4. Apply onboarding tag to contact

Read the contact's existing `tags` array. Append `ONBOARDING_TAG` (default: `"onboarding"`) if not already present:

```json
{
  "tags": ["<existing tags>", "onboarding"]
}
```

If the tag is already present: note "tag already applied" in the activity log and skip the update.

### 5. Create onboarding tasks

Split `ONBOARDING_TASKS` on commas (default: `"Send welcome email,Schedule kickoff call,Share onboarding docs"`). For each task:

```json
{
  "recordType": "deals",
  "recordId": "<dealId>",
  "type": "task",
  "note": "<task description>"
}
```

If `ONBOARDING_TASKS` is empty or unset: skip this step, log a warning in the summary activity.

### 6. Log welcome activity

```json
{
  "recordType": "deals",
  "recordId": "<dealId>",
  "type": "agent_action",
  "note": "Onboarding sequence initiated. Tasks created: [<task list>]. Tag applied: <ONBOARDING_TAG>. Contact: <First Last>."
}
```

### 7. Request approval (if REQUIRE_APPROVAL=true)

```json
{
  "type": "outreach",
  "title": "Send welcome message to <First Last> — deal: <deal.name> (<deal.value>)",
  "requestedBy": "onboarding-trigger",
  "context": {
    "dealId": "<id>",
    "contactId": "<id>",
    "dealName": "<name>",
    "dealValue": "<value>"
  }
}
```

Cap at 10 approval requests per run. Log additional deals as "pending approval — cap reached".

### 8. Deliver summary

```
🚀 Onboarding Trigger Run — [Date]

Looked back [N]h · Found [N] newly closed deals

✅ Onboarding initiated: [N]
  • [Company] (deal: "[name] — $[value]")
      Contact: [Name] · Tag: [tag] · [N] tasks created · [Approval requested | Approval skipped]
  [max 10 shown]

⚠️  Skipped (already processed): [N]
⚠️  Skipped (no contact linked): [N]

📋 [N] approval requests created
```

## Outputs

- `ONBOARDING_TAG` applied to each linked contact
- One activity task per `ONBOARDING_TASKS` item, logged on the deal
- One `agent_action` activity noting the onboarding initiation
- One approval request per deal (when `REQUIRE_APPROVAL=true`)
- Console summary

## Notes

- Never send messages directly — only request approval
- Never remove existing tags; only append the onboarding tag
- Never re-process a deal that already has an "Onboarding sequence initiated" activity
- Requires operator or developer role on headless-crm-connect
- Works with both SQLite and Postgres Headless CRM backends

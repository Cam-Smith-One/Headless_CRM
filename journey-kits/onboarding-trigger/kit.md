# Onboarding Trigger Kit

An agent workflow that detects deals freshly moved to a "Closed Won" stage, then automatically initiates the customer onboarding sequence: applies an onboarding tag, creates follow-up tasks, logs a welcome activity, and requests human approval before sending the first welcome message.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Queries deals that moved to `CLOSED_WON_STAGE` within the last `LOOKBACK_HOURS`
2. For each newly closed deal, fetches the linked contact record
3. Applies the `ONBOARDING_TAG` to the contact
4. Creates one activity task per item in `ONBOARDING_TASKS`
5. Logs a welcome activity on the deal
6. Requests human approval to send a welcome message (when `REQUIRE_APPROVAL=true`)
7. Delivers a run summary listing every deal processed and approval requests raised

Run on a schedule (e.g. every hour) or trigger from a webhook on deal stage-change events.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed with operator or developer role
- Deals must have a `stage` field and be linked to contacts via `contactId`

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Onboarding behaviour
CLOSED_WON_STAGE=Closed Won          # deal stage that triggers onboarding
ONBOARDING_TAG=onboarding            # tag applied to the linked contact
ONBOARDING_TASKS=Send welcome email,Schedule kickoff call,Share onboarding docs
                                     # comma-separated list of task descriptions
REQUIRE_APPROVAL=true                # request approval before welcome message
LOOKBACK_HOURS=24                    # how far back to look for newly closed deals
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Configure your closed-won stage name

Set `CLOSED_WON_STAGE` to match exactly the stage label used in your pipeline (case-sensitive):

```
CLOSED_WON_STAGE=Closed Won
```

### 3. Define your onboarding task list

Edit `ONBOARDING_TASKS` as a comma-separated string. Each item becomes a separate activity task logged against the deal:

```
ONBOARDING_TASKS=Send welcome email,Schedule kickoff call,Share onboarding docs,Set up billing,Assign CSM
```

### 4. Run on demand or schedule

Ask your agent: *"Run the onboarding trigger for any deals closed in the last 24 hours"*

Or add to your cron:

```json
{
  "schedule": "0 * * * *",
  "prompt": "Run onboarding trigger for newly closed deals",
  "skill": "onboarding-trigger"
}
```

---

## Workflow (what the agent does)

```
1. crm_query deals {
     filters: { stage: CLOSED_WON_STAGE, updatedAt_gte: now() - LOOKBACK_HOURS },
     limit: 50
   }

   If zero deals: report "No newly closed deals found" and stop.

For each deal:
2. Fetch linked contact:
   crm_get contacts/<deal.contactId>

3. Apply onboarding tag to contact:
   crm_update contacts/<contactId> { tags: [...existing, ONBOARDING_TAG] }

4. For each task in ONBOARDING_TASKS:
   crm_log_activity {
     recordType: "deals",
     recordId: <dealId>,
     type: "task",
     note: <task description>
   }

5. Log welcome activity:
   crm_log_activity {
     recordType: "deals",
     recordId: <dealId>,
     type: "agent_action",
     note: "Onboarding sequence initiated. Tasks created: [task list]. Tag applied: ONBOARDING_TAG."
   }

6. If REQUIRE_APPROVAL=true:
   crm_request_approval {
     type: "outreach",
     title: "Send welcome message to <First Last> — deal: <deal.name>",
     requestedBy: "onboarding-trigger",
     context: { dealId, contactId, dealName: deal.name, dealValue: deal.value }
   }

7. Deliver summary: N deals processed, N tags applied, N task sets created, N approval requests raised
```

---

## Output Summary Format

```
🚀 Onboarding Trigger Run — 19 May 2026

Looked back 24h · Found 3 newly closed deals

✅ Onboarding initiated:
  • Acme Corp (deal: "Acme Annual Licence — $24,000")
      Contact: Sarah Chen · Tag: onboarding · 3 tasks created · Approval requested
  • Nexus AI (deal: "Nexus Starter Pack — $8,500")
      Contact: Marcus Johnson · Tag: onboarding · 3 tasks created · Approval requested
  • CloudBase (deal: "CloudBase Pro — $15,000")
      Contact: Elena Volkov · Tag: onboarding · 3 tasks created · Approval requested

📋 3 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**Deal has no linked contact** — `contactId` is null on the deal. The agent logs the task activities against the deal anyway, skips the tag step, notes the missing contact in the activity log, and includes the deal in the summary with a warning.

**Tag already applied** — the contact already has `ONBOARDING_TAG`. The agent skips re-applying the tag and logs "onboarding already tagged" in the activity note to avoid duplicate entries.

**Same deal processed twice** — if `LOOKBACK_HOURS` overlaps between runs, the same deal can appear again. The agent checks for an existing activity of type `agent_action` with note starting "Onboarding sequence initiated" and skips the deal if found.

**Approval spam on large batch closes** — if many deals close simultaneously (e.g. end-of-quarter), the agent caps approval requests at 10 per run and logs the rest as pending. Raise the cap by adjusting `MAX_APPROVALS_PER_RUN` if needed.

**`ONBOARDING_TASKS` is empty or unset** — the agent skips task creation and logs a warning in the activity note. Onboarding tag and approval request still proceed normally.

---

## Constraints

- Only processes deals whose `updatedAt` falls within `LOOKBACK_HOURS`. Deals closed before that window are not re-triggered.
- Task creation uses `crm_log_activity` with `type: "task"`. If your CRM instance does not support task-type activities, tasks are logged as `agent_action` notes instead.
- Does not send messages directly — only requests approval. The human sends the welcome message from the dashboard.
- Works with both SQLite and Postgres Headless CRM backends.

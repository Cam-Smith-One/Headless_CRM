# Inbound Router Kit

An agent workflow that picks up newly created contacts that have not yet been assigned to a pipeline, evaluates each lead against configurable routing rules (lead source, company size, industry, ICP criteria), assigns them to the correct pipeline and stage, creates a linked deal record, applies routing tags, and optionally requests human approval before routing high-value inbound leads.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Queries contacts created in the last `LOOKBACK_HOURS` that have no open deal in any pipeline
2. For each unrouted contact, reads lead source, company, and any ICP signals from their record
3. Evaluates the contact against `ROUTING_RULES` to determine the target pipeline and initial stage
4. Creates a deal record in the matched pipeline and stage, linked to the contact
5. Applies a routing tag derived from the matched rule (e.g. `routed:enterprise`, `routed:smb`)
6. Logs a routing activity explaining which rule matched and why
7. Requests human approval for leads whose estimated value exceeds `HIGH_VALUE_THRESHOLD`
8. Delivers a routing summary grouped by pipeline

Run hourly, or trigger from a webhook on contact creation events.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed with operator or developer role
- Contacts should have `customFields` populated with lead source and company size signals (from web forms, enrichment, or the contact-enrichment kit)
- Pipelines named in `ROUTING_RULES` and `DEFAULT_PIPELINE` must already exist in the CRM

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Routing behaviour
LOOKBACK_HOURS=24                    # how far back to look for newly created contacts
ROUTING_RULES='[{"match":{"leadSource":"enterprise-form","minCompanySize":200},"pipeline":"Enterprise","stage":"Discovery"},{"match":{"leadSource":"smb-form","maxCompanySize":199},"pipeline":"SMB","stage":"Intro Call"},{"match":{"leadSource":"partner-referral"},"pipeline":"Partner","stage":"Qualified"}]'
                                     # JSON array of routing rule objects (see below)
DEFAULT_PIPELINE=Inbound             # pipeline to use when no rule matches
DEFAULT_STAGE=New Lead               # stage within the default pipeline
HIGH_VALUE_THRESHOLD=10000           # deal value (numeric) above which approval is required
REQUIRE_APPROVAL_HIGH_VALUE=true     # request approval for leads above HIGH_VALUE_THRESHOLD
```

---

## Routing Rules Format

`ROUTING_RULES` is a JSON array. Each rule is evaluated in order; the first match wins.

```json
[
  {
    "match": {
      "leadSource": "enterprise-form",   // exact match on customFields.leadSource
      "minCompanySize": 200              // customFields.companySize >= this
    },
    "pipeline": "Enterprise",
    "stage": "Discovery",
    "tag": "routed:enterprise",
    "estimatedValue": 50000
  },
  {
    "match": {
      "leadSource": "smb-form",
      "maxCompanySize": 199
    },
    "pipeline": "SMB",
    "stage": "Intro Call",
    "tag": "routed:smb",
    "estimatedValue": 8000
  },
  {
    "match": {
      "leadSource": "partner-referral"
    },
    "pipeline": "Partner",
    "stage": "Qualified",
    "tag": "routed:partner",
    "estimatedValue": 20000
  }
]
```

Fields supported in `match`: `leadSource`, `industry`, `minCompanySize`, `maxCompanySize`, `tags_includes`, `country`. All fields in a rule must match for the rule to fire. Omitted fields are ignored (wildcard).

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Define your routing rules

Edit `ROUTING_RULES` as a JSON array. Rules are evaluated in order — put the most specific rules first. The agent falls back to `DEFAULT_PIPELINE` / `DEFAULT_STAGE` when no rule matches.

### 3. Ensure pipelines exist

Create the pipelines named in your rules inside the CRM before running. The agent will fail gracefully (log an error, use default pipeline) if a named pipeline does not exist.

### 4. Run on demand or schedule

Ask your agent: *"Route any new inbound contacts that came in today"*

Or add to your cron:

```json
{
  "schedule": "0 * * * *",
  "prompt": "Route new inbound contacts created in the last hour",
  "skill": "inbound-router"
}
```

---

## Workflow (what the agent does)

```
1. crm_query contacts {
     filters: { createdAt_gte: now() - LOOKBACK_HOURS },
     limit: 50
   }

2. For each contact, check if already routed:
   crm_query deals { filters: { contactId: <id> } }
   → If any deal exists: skip this contact (already routed)

   If all contacts are already routed: report summary and stop.

For each unrouted contact:
3. Read routing signals from contact:
   - customFields.leadSource
   - customFields.companySize
   - customFields.industry
   - customFields.country
   - contact.tags

4. Evaluate ROUTING_RULES in order (first match wins):
   → If match found: use rule's pipeline, stage, tag, estimatedValue
   → If no match: use DEFAULT_PIPELINE, DEFAULT_STAGE, tag = "routed:default", estimatedValue = 0

5. Create deal:
   crm_create deals {
     name: "<First Last> — <Company|lead source>",
     contactId: <contactId>,
     companyId: <contact.companyId>,
     pipelineId: <resolved pipeline id>,
     stage: <matched stage>,
     value: <estimatedValue from rule or 0>,
     expectedCloseDate: <today + 90 days>
   }

6. Apply routing tag to contact:
   crm_update contacts/<id> { tags: [...existing, <routing tag>] }

7. Log routing activity:
   crm_log_activity {
     recordType: "contacts",
     recordId: <contactId>,
     type: "agent_action",
     note: "Routed to pipeline '<pipeline>', stage '<stage>'. Rule matched: <rule summary|default>. Deal created: <dealId>."
   }

8. If REQUIRE_APPROVAL_HIGH_VALUE=true AND estimatedValue >= HIGH_VALUE_THRESHOLD:
   crm_request_approval {
     type: "outreach",
     title: "High-value inbound routed: <First Last> — est. $<value> → <pipeline>",
     requestedBy: "inbound-router",
     context: { contactId, dealId, pipeline, stage, estimatedValue, ruleMatched }
   }

9. Deliver summary grouped by pipeline
```

---

## Output Summary Format

```
📥 Inbound Router Run — 19 May 2026

Looked back 24h · Found 8 new contacts · 6 unrouted

Routed contacts:
  Enterprise pipeline (2):
    • Sarah Chen @ Acme Corp → Discovery — est. $50,000 ⚑ approval requested
    • Marcus Johnson @ TechFlow → Discovery — est. $50,000 ⚑ approval requested

  SMB pipeline (3):
    • Elena Volkov @ StartupCo → Intro Call — est. $8,000
    • James Park @ QuickTools → Intro Call — est. $8,000
    • Priya Nair @ DataSmith → Intro Call — est. $8,000

  Inbound (default) pipeline (1):
    • Unknown Lead → New Lead — est. $0

⏭️  Skipped (already had deal): 2

📋 2 approval requests created → http://localhost:3000/approvals
```

---

## Failure Patterns and Mitigations

**Named pipeline does not exist** — the pipeline in the matched rule was not created in the CRM. The agent logs an error activity, falls back to `DEFAULT_PIPELINE`, and flags the contact in the summary with "pipeline not found — used default". Create the missing pipeline in the dashboard and re-run.

**Contact has no routing signals** — `customFields` are empty (common for manually entered contacts). No rule matches; the contact is routed to `DEFAULT_PIPELINE` / `DEFAULT_STAGE`. Use the contact-enrichment kit to populate signals before routing for better accuracy.

**Same contact processed twice** — if `LOOKBACK_HOURS` overlaps between runs, the deal-existence check in step 2 prevents duplicate deals. Contacts with an existing deal are always skipped.

**High-value approval spam** — if many high-value leads arrive simultaneously, the agent caps approval requests at 10 per run. Remaining high-value leads are routed normally and noted as "approval pending — cap reached".

**`ROUTING_RULES` is invalid JSON** — the agent falls back to default pipeline for all contacts and logs a configuration error at the top of the summary. Validate your JSON string before setting the environment variable.

---

## Constraints

- Only contacts created within `LOOKBACK_HOURS` are considered. Older contacts must be routed manually or by re-running with a larger window.
- A contact is considered "already routed" if any deal record exists with that `contactId`, regardless of pipeline or stage.
- `estimatedValue` in routing rules is used as the deal's initial value. If omitted from a rule, deal value is set to `0`.
- Deal `expectedCloseDate` defaults to today + 90 days. Override per rule by adding `"closeInDays": N` to the rule object.
- Works with both SQLite and Postgres Headless CRM backends.

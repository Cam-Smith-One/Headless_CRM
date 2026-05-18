# Skill: Inbound Router

## Purpose

Pick up newly created contacts that have no deal in any pipeline, evaluate each lead's routing signals against configurable rules, assign them to the correct pipeline and stage by creating a deal record, apply a routing tag, log the routing decision, and optionally request human approval for high-value inbound leads.

## When to Use

- User asks to "route new inbound leads", "assign contacts to pipelines", or similar
- Hourly or daily cron fires to process new form submissions or enriched contacts
- Webhook event signals new contact creation
- User wants to audit which recent contacts haven't been routed yet

## Steps

### 1. Fetch newly created contacts

```json
{
  "collection": "contacts",
  "filters": { "createdAt_gte": "<ISO timestamp for now minus LOOKBACK_HOURS>" },
  "limit": 50
}
```

Default `LOOKBACK_HOURS`: `24`.

If zero contacts: report "No new contacts found in the last LOOKBACK_HOURS hours" and stop.

### 2. Filter out already-routed contacts

For each contact, check for an existing deal:

```json
{
  "collection": "deals",
  "filters": { "contactId": "<contactId>" }
}
```

If any deal exists for the contact: add to "skipped" list and move on. If all contacts are already routed: report the skip count and stop.

### 3. For each unrouted contact — read routing signals

Extract from the contact record:
- `customFields.leadSource` — the origin channel (e.g. `"enterprise-form"`)
- `customFields.companySize` — numeric employee count
- `customFields.industry` — industry string
- `customFields.country` — country code or name
- `contact.tags` — existing tags array

If `companyId` is set, call `crm_get companies/<companyId>` for additional company signals.

### 4. Evaluate routing rules

Parse `ROUTING_RULES` as a JSON array. Evaluate each rule in order; use the first match. For each rule's `match` object:

- `leadSource` — exact string match against `customFields.leadSource`
- `minCompanySize` — `customFields.companySize >= value`
- `maxCompanySize` — `customFields.companySize <= value`
- `industry` — exact string match against `customFields.industry`
- `tags_includes` — `contact.tags` contains this value
- `country` — exact string match against `customFields.country`

All fields specified in a rule's `match` must match for the rule to fire. Unspecified fields are wildcards.

If no rule matches: use `DEFAULT_PIPELINE` (default: `"Inbound"`) and `DEFAULT_STAGE` (default: `"New Lead"`). Set routing tag to `"routed:default"` and estimated value to `0`.

### 5. Create deal record

```json
{
  "name": "<First Last> — <company name or leadSource>",
  "contactId": "<contactId>",
  "companyId": "<contact.companyId or null>",
  "stage": "<matched stage>",
  "value": "<estimatedValue from rule or 0>",
  "expectedCloseDate": "<today + closeInDays from rule, default 90 days>"
}
```

Resolve the `pipelineId` by calling `crm_search pipelines { name: "<pipeline name>" }` if the pipeline lookup is needed. If the named pipeline is not found: log an error activity, use `DEFAULT_PIPELINE`, and flag in summary.

### 6. Apply routing tag to contact

Read existing `contact.tags`. Append the routing tag from the matched rule (e.g. `"routed:enterprise"`) if not already present:

```json
{
  "tags": ["<existing tags>", "<routing tag>"]
}
```

### 7. Log routing activity

```json
{
  "recordType": "contacts",
  "recordId": "<contactId>",
  "type": "agent_action",
  "note": "Routed to pipeline '<pipeline>', stage '<stage>'. Rule matched: <rule summary or 'default'>. Deal created: <dealId>. Signals used: leadSource=<val>, companySize=<val>, industry=<val>."
}
```

### 8. Request approval for high-value leads

If `REQUIRE_APPROVAL_HIGH_VALUE=true` (default: `true`) and `estimatedValue >= HIGH_VALUE_THRESHOLD` (default: `10000`):

```json
{
  "type": "outreach",
  "title": "High-value inbound routed: <First Last> — est. $<value> → <pipeline> / <stage>",
  "requestedBy": "inbound-router",
  "context": {
    "contactId": "<id>",
    "dealId": "<id>",
    "pipeline": "<name>",
    "stage": "<name>",
    "estimatedValue": <number>,
    "ruleMatched": "<rule summary or 'default'>"
  }
}
```

Cap at 10 approval requests per run. Flag remaining high-value leads as "approval pending — cap reached" in the summary.

### 9. Deliver summary

Group routed contacts by pipeline, sorted by estimated value descending within each group:

```
📥 Inbound Router Run — [Date]

Looked back [N]h · Found [N] new contacts · [N] unrouted

Routed contacts:
  [Pipeline name] ([N]):
    • [Name] @ [Company] → [Stage] — est. $[value] [⚑ approval requested]
    [sorted by value desc, max 5 per pipeline shown]

  [Next pipeline] ([N]):
    ...

⏭️  Skipped (already had deal): [N]
⚠️  Configuration errors: [N] (pipeline not found — used default)

📋 [N] approval requests created
```

Skip sections with zero entries.

## Outputs

- One deal record created per unrouted contact, placed in the correct pipeline and stage
- Routing tag applied to each contact
- One `agent_action` activity per contact with routing decision and signals
- One approval request per high-value lead (when enabled)
- Console summary grouped by pipeline

## Notes

- Never create more than one deal per contact per run — always check for existing deals first
- Never overwrite existing tags — only append the routing tag
- If `ROUTING_RULES` fails JSON parsing: fall back to default pipeline for all contacts, log a configuration error at the top of the summary, and do not halt the run
- Deal `expectedCloseDate` defaults to today + 90 days; rules may override with `"closeInDays": N`
- Requires operator or developer role on headless-crm-connect
- Works with both SQLite and Postgres Headless CRM backends

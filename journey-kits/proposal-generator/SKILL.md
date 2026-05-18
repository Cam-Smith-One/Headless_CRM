# Skill: Proposal Generator

## Purpose

Generate a tailored sales proposal outline for a specific deal, using all available CRM context: contact details, company, deal value, stage history, and recent activities. Outputs markdown and logs the draft to the deal. Never sends anything — output is for human review only.

## When to Use

- When the user asks to "generate a proposal", "write a proposal outline", or "draft a proposal" for a deal or contact
- When a rep asks "help me prep a proposal for [company]" before a meeting
- When the user provides a deal ID and asks for a proposal

## Steps

### 1. Resolve the target deal

**If a deal ID is provided:**
```json
{ "tool": "crm_get", "collection": "deals", "id": "[dealId]" }
```

**If a contact or company name is provided:**
```json
{ "tool": "crm_search", "query": "[name]", "collections": ["deals", "contacts"] }
```
From the results, select the most relevant active deal (prefer highest `value`, then most recently updated). If multiple deals match, ask the user to confirm which one before proceeding.

### 2. Fetch supporting records

Run these in parallel:

```json
{ "tool": "crm_get", "collection": "contacts", "id": "[deal.contactId]" }
```

If `deal.companyId` is set:
```json
{ "tool": "crm_get", "collection": "companies", "id": "[deal.companyId]" }
```

### 3. Fetch stage history

```json
{ "tool": "crm_stage_history", "dealId": "[deal.id]" }
```

Calculate:
- Days in current stage
- Total days in pipeline
- Last major stage advance (most recent forward move)

### 4. Fetch recent activities

```json
{ "collection": "activities", "filters": { "dealId": "[deal.id]" }, "limit": 10, "sort": "createdAt_desc" }
```

Extract: last interaction date, activity types, any topics or objections mentioned in `note` fields.

### 5. Select pricing tier

Parse `PRICING_TIERS` from the environment (JSON array). Match the recommended tier:
- If `deal.value` is set: select the tier whose price is closest to (but not above) the deal value, or the highest tier for enterprise-sized deals
- If `deal.value` is not set: default to the middle tier
- Mark the selected tier with **bold** in the pricing table

### 6. Generate the proposal outline

Using all collected context plus `COMPANY_NAME`, `PRODUCT_NAME`, and optional `PROPOSAL_TEMPLATE`, produce a markdown document with these sections:

**Header block**
- Prepared for: `[contact.firstName] [contact.lastName], [contact title if in customFields] — [company name]`
- Deal value, preparer (COMPANY_NAME), date

**Executive Summary** — 2–3 sentences connecting the company's context to the product's value proposition. Reference deal stage and pipeline duration to signal familiarity.

**Problem Statement** — 3 bullet points inferred from activity notes and deal context. If no notes are available, use generic pain points appropriate for the deal value and industry.

**Proposed Solution** — 3 bullet points mapping product features (from `PRODUCT_NAME` and `PROPOSAL_TEMPLATE`) to the problem points above.

**Recommended Tier** — name, price, and one-line rationale tied to deal context.

**Pricing Table** — all tiers from `PRICING_TIERS` in a markdown table. Bold the recommended row.

**Next Steps** — 4 numbered steps ending with "Signature and kickoff call". Dates are relative (e.g. "by [today + 4 days]").

**Footer** — italic note: *"This proposal was generated from CRM context and is for internal review only. Edit before sending."*

If `PROPOSAL_TEMPLATE` is set, use its instructions to shape tone, emphasis, and any product-specific language throughout.

### 7. Output to conversation

Present the complete markdown proposal in the conversation. State clearly at the top: "Here is the proposal draft — review and edit before sending."

### 8. Log to deal

```json
{
  "tool": "crm_log_activity",
  "dealId": "[deal.id]",
  "type": "proposal_draft",
  "note": "[full proposal markdown text]"
}
```

Confirm to the user: "Proposal draft logged to the deal."

## Outputs

- A complete proposal outline as markdown, presented in the conversation
- One `proposal_draft` activity logged on the deal

## Notes

- Never send the proposal anywhere — email, Slack, or otherwise. Output is always to the conversation only
- If `crm_log_activity` fails, still output the proposal and report the log failure separately
- If search returns no active deals, report clearly and ask the user to provide a deal ID
- Requires `headless-crm-connect` kit installed and `crm_*` tools available
- Works with both SQLite and Postgres Headless CRM backends

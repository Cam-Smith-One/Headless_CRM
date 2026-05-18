# Proposal Generator Kit

Given a deal ID or contact name, pulls the full deal context — contact details, company, deal value, stage history, recent activities, and notes — and generates a tailored sales proposal outline: executive summary, problem statement, proposed solution, pricing tier suggestion, and next steps. Outputs as markdown and logs it as an activity on the deal. Does not send anything; the output is always for human review first.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

On demand, your agent:

1. Resolves the target deal by ID or by searching for a contact or company name
2. Fetches the full deal record, linked contact, linked company, stage history, and recent activities
3. Extracts key context: deal value, stage, how long in the current stage, last activity, any notes or custom fields
4. Selects the most appropriate pricing tier from `PRICING_TIERS` based on deal value
5. Generates a structured proposal outline using the deal context and optional `PROPOSAL_TEMPLATE`
6. Outputs the proposal as clean markdown to the conversation
7. Logs the proposal as a `proposal_draft` activity on the deal for future reference

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and verified

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...
HEADLESS_CRM_TENANT_ID=tenant_...

# Required for proposal content
COMPANY_NAME=Acme Inc
PRODUCT_NAME=Acme Platform

# Pricing tiers (JSON array)
PRICING_TIERS=[{"name":"Starter","price":"$99/mo","description":"Up to 5 users, core features"},{"name":"Pro","price":"$299/mo","description":"Unlimited users, advanced features"},{"name":"Enterprise","price":"Custom","description":"Dedicated support, SLAs, custom integrations"}]

# Optional
PROPOSAL_TEMPLATE=          # custom prompt/instructions for your product or industry
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Configure your product details

Set `COMPANY_NAME`, `PRODUCT_NAME`, and `PRICING_TIERS` in your environment. The pricing tiers JSON must be a valid array — validate it at jsonlint.com if unsure.

### 3. Optionally add a proposal template

Set `PROPOSAL_TEMPLATE` to a short prompt that shapes the proposal tone or content. Examples:
- `"Focus on ROI and time-to-value. This is a B2B SaaS product sold to operations teams."`
- `"We sell to healthcare providers. Emphasise compliance, security, and patient outcomes."`

### 4. Run on demand

Ask your agent:
- *"Generate a proposal for the Acme Corp deal"*
- *"Write a proposal for deal ID d_abc123"*
- *"Create a proposal outline for Sarah Kim at Nexus AI"*

---

## Workflow (what the agent does)

```
1. Resolve deal:
   If deal ID provided:
     crm_get { collection: "deals", id: dealId }
   If contact/company name provided:
     crm_search { query: "[name]", collections: ["deals","contacts"] }
     → select most relevant active deal

2. crm_get { collection: "contacts", id: deal.contactId }
3. crm_get { collection: "companies", id: deal.companyId }  (if companyId set)

4. crm_stage_history { dealId: deal.id }
   → calculate days in current stage, previous stages

5. crm_query { collection: "activities", filters: { dealId: deal.id },
     limit: 10, sort: "createdAt_desc" }
   → extract recent interaction context, topics mentioned, objections noted

6. Select pricing tier from PRICING_TIERS:
   → match by deal.value (closest tier by price point)
   → if deal.value not set, use middle tier

7. Generate proposal outline using:
   - Contact: firstName, lastName, email, score
   - Company: name, industry (from customFields if available)
   - Deal: name, value, stage, expectedCloseDate
   - Stage history: time in pipeline, last major move
   - Recent activities: key topics, last interaction date
   - COMPANY_NAME, PRODUCT_NAME, PRICING_TIERS
   - PROPOSAL_TEMPLATE (if set)

8. Output proposal as markdown to conversation

9. crm_log_activity {
     dealId: deal.id,
     type: "proposal_draft",
     note: "[full proposal markdown]"
   }
```

---

## Output Summary Format

```markdown
# Proposal: Acme Platform for Nexus AI

**Prepared for:** Sarah Kim, Head of Operations — Nexus AI  
**Deal value:** $30,000  
**Prepared by:** [COMPANY_NAME]  
**Date:** 18 May 2026

---

## Executive Summary

Nexus AI is evaluating Acme Platform to streamline their operations workflow.
This proposal outlines how Acme Platform addresses their key challenges and
delivers measurable value within 90 days.

---

## Problem Statement

Based on our conversations, Nexus AI is experiencing:
- Manual reporting consuming 10+ hours per week across the ops team
- Lack of visibility into cross-department project status
- Difficulty scaling onboarding as headcount grows

---

## Proposed Solution

Acme Platform's Pro tier provides:
- Automated reporting with real-time dashboards
- Centralised project tracking with role-based access
- Guided onboarding workflows and template library

---

## Recommended Tier

**Pro — $299/mo**  
Unlimited users · Advanced features · Priority support

This tier aligns with Nexus AI's team size and the workflows discussed.

---

## Pricing

| Tier | Price | Best for |
|------|-------|----------|
| Starter | $99/mo | Up to 5 users, core features |
| **Pro** | **$299/mo** | **Unlimited users, advanced features** |
| Enterprise | Custom | Dedicated support, SLAs, custom integrations |

---

## Next Steps

1. Review this proposal with your team (suggested: by 22 May)
2. Schedule a 30-minute demo of the reporting module
3. Legal review of standard MSA (1–2 days)
4. Signature and kickoff call

---

*This proposal was generated from CRM context and is for internal review only.
Edit before sending.*
```

---

## Failure Patterns and Mitigations

**Deal not found by name search** — `crm_search` may not find partial company names. Try the full company name or use the deal ID directly from the CRM dashboard.

**No recent activities found** — the proposal problem statement will be generic. Log discovery call notes to the deal before generating for a more tailored output.

**PRICING_TIERS JSON is invalid** — the agent will fall back to listing tiers as plain text. Validate the JSON and re-set the environment variable.

**Proposal logged to wrong deal** — if search returned multiple results, the agent picks the most recently updated active deal. Disambiguate by providing the deal ID directly.

**Proposal too generic** — set `PROPOSAL_TEMPLATE` with product-specific context. The more specific the template, the more tailored the output.

---

## Constraints

- This kit never sends anything. Output is always presented for human review before any distribution.
- The proposal is an outline, not a finished document. It is designed to be edited and completed by a human.
- Custom fields on contacts and companies are included in context if present, but field names must match your CRM schema exactly.
- Fetches up to 10 recent activities for context. For longer deal histories, increase the limit in the workflow query or review `crm_stage_history` output.

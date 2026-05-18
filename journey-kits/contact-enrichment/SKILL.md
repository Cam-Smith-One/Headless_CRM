# Contact Enrichment

Find contacts and companies in Headless CRM with missing fields, research them from public sources, and fill the gaps using the non-destructive enrichment API.

## Instructions

When the user asks to enrich contacts, fill missing data, or this skill fires on schedule:

### 1. Identify what to enrich

Check `ENRICH_FIELDS` (default: `title,phone,linkedinUrl,location`). Split into a list.

Query contacts with any of those fields missing:
```json
{ "collection": "contacts", "filters": { "<field>": null }, "limit": 15 }
```

Query companies if `ENRICH_COMPANIES=true` (default):
```json
{ "collection": "companies", "filters": { "employeeCount": null }, "limit": 15 }
```

Cap total records at `MAX_RECORDS_PER_RUN` (default: 15).

If nothing to enrich: report "All contacts and companies have complete data" and stop.

### 2. For each contact

**a. Build search query**

`"[firstName] [lastName] [companyName] linkedin title"`

If the contact has no company: `"[firstName] [lastName] [email domain] professional"`

**b. Research**

Use web search (or Exa if `EXA_API_KEY` is set) to find:
- Job title / role
- LinkedIn profile URL
- Work location (city, country)
- Phone number (work, not personal)

**c. Confidence check**

Before writing any field, verify the result matches the contact's name AND company. If confidence is low (common name, multiple results, no company to cross-reference): skip and note it.

**d. Enrich**

POST to the enrichment endpoint with only the fields you found:
```
POST [HEADLESS_CRM_API_URL]/api/contacts/[id]/enrich
{
  "data": {
    "title": "VP Engineering",
    "linkedinUrl": "https://linkedin.com/in/...",
    "location": "San Francisco, CA"
  }
}
```

The endpoint is non-destructive — only empty fields are written. Never include fields you aren't confident about.

**e. Log**

```json
{
  "recordType": "contacts",
  "recordId": "<id>",
  "type": "agent_action",
  "note": "Enriched: filled [comma-separated field names]. Source: web search. Confidence: high/medium."
}
```

### 3. For each company

**a. Research**

Search for the company's: employee count, funding stage, HQ location, description, LinkedIn company page, Crunchbase.

**b. Enrich**

```
POST [HEADLESS_CRM_API_URL]/api/companies/[id]/enrich
{
  "data": {
    "description": "...",
    "employeeCount": 150,
    "fundingStage": "Series B",
    "location": "New York, NY"
  }
}
```

**c. Log**

```json
{
  "recordType": "companies",
  "recordId": "<id>",
  "type": "agent_action",
  "note": "Enriched company: filled [fields]. Source: [sources]."
}
```

### 4. Deliver summary

```
🔍 Enrichment Run — [Date]

Contacts: [N] enriched, [N] skipped
  Fields filled: [field: count, field: count, ...]

Companies: [N] enriched, [N] skipped
  Fields filled: [field: count, ...]

⚠️ Skipped (no public data): [name @ company, ...]
```

Omit any section with zero items.

## Error Handling

- Research ambiguous (multiple people with same name): skip, add to skipped list
- Enrichment API returns 400: log the exact error, continue to next record
- Web search rate limited: pause 2 seconds, retry once, then skip

## Rules

- Never write data you aren't confident about — skip over write wrong
- Never write personal phone numbers (mobile) — work numbers only
- Never overwrite existing data (the enrichment endpoint handles this, but don't include fields that aren't empty anyway)
- Requires operator or developer role

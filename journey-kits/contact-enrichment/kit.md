# Contact Enrichment Kit

Automatically fill gaps in your CRM contacts and companies. The agent picks up records with missing fields (LinkedIn, title, phone, company size, funding stage), researches them from public sources, and writes the data back using Headless CRM's enrichment API — without overwriting fields you've already filled in.

Requires the `headless-crm-connect` kit to be installed first.

**Owner:** humaie  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Dependency:** humaie/headless-crm-connect

---

## What It Does

1. Finds contacts or companies where key fields are empty
2. Researches each record from public sources (web, LinkedIn, Crunchbase, etc.)
3. Calls `POST /api/contacts/:id/enrich` or `POST /api/companies/:id/enrich` — which fills gaps without clobbering existing data
4. Logs an activity entry for every enrichment
5. Delivers a summary of what was filled and what couldn't be found

The enrichment API is **non-destructive**: it only fills null/empty fields. Existing values are never overwritten.

---

## Critical Requirements

### Dependencies
- **headless-crm-connect** kit installed and operator role
- Web search access or an enrichment API (optional but improves quality)

### Environment Variables

```
# Required
HEADLESS_CRM_API_URL=http://localhost:3001
HEADLESS_CRM_TOKEN=hcrm_sk_...

# Behaviour
ENRICH_CONTACTS=true                     # enrich contacts (default: true)
ENRICH_COMPANIES=true                    # enrich companies (default: true)
MAX_RECORDS_PER_RUN=15                   # cap per run
ENRICH_FIELDS=title,phone,linkedinUrl,location  # comma-separated fields to target

# Optional enrichment APIs (improves accuracy and coverage)
EXA_API_KEY=                             # Exa neural search
CLEARBIT_API_KEY=                        # Clearbit enrichment
APOLLO_API_KEY=                          # Apollo.io enrichment
```

---

## Setup Steps

### 1. Install headless-crm-connect first

```
/headless-crm connect
```

### 2. Run enrichment on demand

Ask your agent: *"Enrich the contacts in my CRM that are missing titles and LinkedIn URLs"*

Or on a schedule:
```json
{
  "schedule": "0 10 * * 1",
  "prompt": "Enrich any contacts or companies with missing fields",
  "skill": "contact-enrichment"
}
```

---

## Workflow (what the agent does)

```
# Contacts
1. crm_query contacts { filters: { title: null }, limit: MAX_RECORDS_PER_RUN }
   (or whichever fields are in ENRICH_FIELDS)

For each contact:
2. Web search: "[firstName] [lastName] [company] site:linkedin.com OR title OR email"
3. Extract: title, LinkedIn URL, phone, location
4. POST /api/contacts/<id>/enrich { data: { title, linkedinUrl, ... } }
   (only missing fields are written — existing data is preserved)
5. crm_log_activity { note: "Enriched: filled [fields]. Source: web search." }

# Companies (if ENRICH_COMPANIES=true)
6. crm_query companies { filters: { employeeCount: null }, limit: MAX_RECORDS_PER_RUN }
For each company:
7. Research: size, funding, HQ location, description, LinkedIn
8. POST /api/companies/<id>/enrich { data: { employeeCount, fundingStage, ... } }
9. Log activity
```

---

## Enrichment Field Reference

### Contact fields enriched

| Field | Source | Notes |
|-------|--------|-------|
| `title` | LinkedIn, web search | Job title |
| `phone` | Company directory, web | Work phone preferred |
| `linkedinUrl` | LinkedIn search | Profile URL |
| `location` | LinkedIn, web | City, Country |
| `customFields.twitter` | Twitter/X search | Handle |
| `customFields.bio` | LinkedIn summary | Short bio |

### Company fields enriched

| Field | Source | Notes |
|-------|--------|-------|
| `description` | Company website | One paragraph |
| `domain` | Web search | Primary domain |
| `industry` | Crunchbase, web | Sector |
| `employeeCount` | LinkedIn, Crunchbase | Headcount range |
| `fundingStage` | Crunchbase, web | Seed/Series A/etc |
| `location` | Company website | HQ city |
| `customFields.linkedinUrl` | LinkedIn | Company page |
| `customFields.crunchbaseUrl` | Crunchbase | Profile URL |

---

## Output Summary Format

```
🔍 Enrichment Run — 19 May 2026

Contacts: 8 enriched, 2 skipped (no public data found)
  Fields filled: title (7), linkedinUrl (5), location (6)

Companies: 4 enriched, 1 skipped
  Fields filled: employeeCount (4), fundingStage (3), description (4)

⚠️ Could not find: James Park @ DataSynth (no LinkedIn presence)
```

---

## Failure Patterns and Mitigations

**Wrong person found** — common with common names. The agent cross-references company name to confirm before writing. If confidence is low, it skips and notes it rather than writing incorrect data.

**LinkedIn blocks search** — use `site:` operators with Google search instead. Or add `EXA_API_KEY` for neural search which handles this better.

**Enrichment API rejects field** — the `/enrich` endpoint accepts any standard field plus custom fields in a `data` envelope. Unknown top-level keys go into `customFields` automatically.

**Company not attached to contact** — enrichment of `title` and `role` can still proceed. Company-specific enrichment is skipped for that contact.

---

## Constraints

- **Non-destructive:** the enrichment endpoint only fills null/empty fields. Existing values are never touched.
- This kit only writes data from public sources. It never buys data or uses gated APIs without explicit API key configuration.
- Works with both SQLite and Postgres Headless CRM backends.
- Requires operator role. Reader role cannot enrich.
- Max 15 records per run by default. Raise `MAX_RECORDS_PER_RUN` for bulk enrichment jobs.

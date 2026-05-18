# Lead Qualification

Research and score unqualified contacts in Headless CRM against your ICP criteria, update scores, and flag high-value leads for human approval.

## Instructions

When the user asks to qualify leads, score contacts, or this skill fires on schedule:

### 1. Fetch unscored contacts

```json
{ "collection": "contacts", "filters": { "score": null }, "limit": 20 }
```

If `SCORE_THRESHOLD` is set, also fetch contacts below that score:
```json
{ "collection": "contacts", "filters": { "score_lt": "SCORE_THRESHOLD" }, "limit": 20 }
```

Deduplicate by contact ID. Cap total at `MAX_CONTACTS_PER_RUN` (default: 20).

If zero contacts to process: report "No unscored contacts found" and stop.

### 2. For each contact

**a. Get company context**

If `companyId` is set: call `crm_get` for the company record.

**b. Research the company**

Use web search (or Exa/Tavily if API keys are set) to find:
- Employee count
- Funding stage and amount
- Industry/vertical
- Engineering team signals (GitHub, job posts, tech stack)
- Recent news

If research fails or the company is private with no data: note the limitation, proceed with available fields only.

**c. Score 0–100**

Use `ICP_CRITERIA` from the environment (or ask the user if not set) as the scoring rubric. Apply this structure:

- Company size match: 0–25 points
- Industry/vertical match: 0–20 points  
- Funding stage match: 0–20 points
- Contact seniority match: 0–20 points
- Activity/intent signals: 0–15 points

Write a one-sentence justification for the score.

**d. Update the contact**

```json
{
  "score": <0-100>,
  "stage": "Qualified"  // only if score >= 60
}
```

**e. Log the activity**

```json
{
  "recordType": "contacts",
  "recordId": "<contactId>",
  "type": "agent_action",
  "note": "Lead scored <N>/100. <One sentence justification>. Research: <key finding>."
}
```

**f. Request approval if high-value**

If score >= `AUTO_ADVANCE_THRESHOLD` (default: 80):

```json
{
  "type": "bulk_operation",
  "title": "Advance <First Last> (<Company>) to Proposal — scored <N>/100",
  "requestedBy": "<agent name>",
  "context": { "contactId": "...", "score": N, "justification": "..." }
}
```

**g. Apply tag if qualified**

If score >= 60 and `QUALIFICATION_TAG` is set:
```json
{ "name": "QUALIFICATION_TAG", "objectType": "contacts", "objectId": "<contactId>" }
```

### 3. Deliver summary

After processing all contacts:

```
🎯 Lead Qualification Run — [Date]

Processed [N] contacts in [time]

✅ Qualified (score ≥ 60): [N]
  • [Name] @ [Company] — [score]/100[(approval requested)]
  [max 5 shown, sorted by score desc]

❌ Did not qualify: [N]
  • [Name] @ [Company] — [score]/100 ([top reason])
  [max 5 shown]

📋 [N] approval requests created
```

Skip any section with zero items.

## Error Handling

- Research returns nothing → score on available contact fields only; note in activity log
- `crm_update` fails → log the error, continue to next contact, include in final summary
- Web search rate limited → add 2-second pause between contacts; reduce MAX_CONTACTS_PER_RUN

## Constraints

- Never advance deal stages directly — only request approval
- Never delete or archive contacts during qualification
- Always log an activity entry even if scoring confidence is low
- Requires operator or developer role

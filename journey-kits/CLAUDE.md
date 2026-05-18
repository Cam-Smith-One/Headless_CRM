# Headless CRM — Journey Kit Skills

The following skills are available after installing Headless CRM kits from Journey Kits.

## /headless-crm connect
Connect this agent to a Headless CRM instance via MCP. Run once to configure the MCP server and verify the connection. See `.claude/skills/headless-crm-connect/SKILL.md`.

## /pipeline-brief
Generate and deliver a daily pipeline digest — deals by stage, total value, stale deals, and pending approvals. See `.claude/skills/pipeline-brief/SKILL.md`.

## /weekly-sales-review
Generate a Monday morning narrative covering the previous week: wins, losses, pipeline movement, stage regressions, and a 7-day forecast. See `.claude/skills/weekly-sales-review/SKILL.md`.

## /activity-summariser
Generate a concise relationship summary for any contact, company, or deal — includes health score, milestones, and open items. See `.claude/skills/activity-summariser/SKILL.md`.

## /meeting-prep
Generate a pre-call brief for any contact: who they are, deal status, recent interactions, and suggested talking points. See `.claude/skills/meeting-prep/SKILL.md`.

## /lead-qualification
Research and score unqualified CRM contacts against ICP criteria, update scores, and flag high-value leads for human approval. See `.claude/skills/lead-qualification/SKILL.md`.

## /contact-enrichment
Fill missing fields on CRM contacts and companies from public sources using the non-destructive enrichment API. See `.claude/skills/contact-enrichment/SKILL.md`.

## /inbound-router
Route newly created contacts to the right pipeline and stage using configurable rules. Creates deal records and flags high-value inbound leads for approval. See `.claude/skills/inbound-router/SKILL.md`.

## /follow-up-sequences
Find contacts and deals with no recent activity, draft personalised follow-up notes, and log them — with optional approval before sending. See `.claude/skills/follow-up-sequences/SKILL.md`.

## /deal-closer
Surface deals approaching close date or stalled in stage, ranked by urgency. Request human approval to advance or close high-priority deals. See `.claude/skills/deal-closer/SKILL.md`.

## /proposal-generator
Generate a tailored proposal outline from deal context — executive summary, problem, solution, pricing, next steps. Logs as a draft activity for human review. See `.claude/skills/proposal-generator/SKILL.md`.

## /onboarding-trigger
On Closed Won, kick off a customer onboarding checklist: tasks, tags, welcome activity, and approval request for the welcome message. See `.claude/skills/onboarding-trigger/SKILL.md`.

## /sales-coach
Analyse recent deal activity, flag problem patterns (no next step, slow response, stuck stages, no meetings), and generate a prioritised coaching brief. See `.claude/skills/sales-coach/SKILL.md`.

## /churn-detection
Score existing customers for churn risk based on inactivity, contract end dates, and engagement. Tag high-risk accounts and request human intervention. See `.claude/skills/churn-detection/SKILL.md`.

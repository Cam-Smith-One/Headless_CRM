# Headless CRM — Journey Kits

Plug-and-play agent workflows for [Headless CRM](https://github.com/Cam-Smith-One/Headless_CRM) on the [Journey Kits registry](https://www.journeykits.ai).

Install any kit and your agent immediately gains a new capability — no integration code required. All kits require `humaie/headless-crm-connect` first.

---

## Kits

### Foundation

| Kit | What it does |
|-----|-------------|
| [headless-crm-connect](#headless-crm-connect) | Wire any agent to Headless CRM via MCP — 29 tools unlocked instantly |

### Daily Operations

| Kit | What it does |
|-----|-------------|
| [pipeline-brief](#pipeline-brief) | Morning digest: pipeline value, stage distribution, stale deals, pending approvals |
| [weekly-sales-review](#weekly-sales-review) | Monday narrative: wins/losses, pipeline movement, regressions, and 7-day forecast |
| [activity-summariser](#activity-summariser) | Concise relationship summary for any contact, company, or deal — on demand |
| [meeting-prep](#meeting-prep) | Pre-call brief: contact profile, deal status, recent activities, talking points |

### Lead Management

| Kit | What it does |
|-----|-------------|
| [lead-qualification](#lead-qualification) | Score unqualified contacts against your ICP and approve high-value leads |
| [contact-enrichment](#contact-enrichment) | Fill missing fields from public sources — non-destructive |
| [inbound-router](#inbound-router) | Route new inbound contacts to the right pipeline based on configurable rules |
| [follow-up-sequences](#follow-up-sequences) | Draft follow-ups for contacts with no activity in N days |

### Deal Execution

| Kit | What it does |
|-----|-------------|
| [deal-closer](#deal-closer) | Surface deals approaching close date or stalled in stage, ranked by urgency |
| [proposal-generator](#proposal-generator) | Generate a tailored proposal outline from deal context — outputs for human review |
| [onboarding-trigger](#onboarding-trigger) | On Closed Won, kick off an onboarding checklist and request approval for welcome message |
| [sales-coach](#sales-coach) | Flag deals with no next step, slow response, or stuck stages — coaching brief per deal |

### Retention

| Kit | What it does |
|-----|-------------|
| [churn-detection](#churn-detection) | Score customers for churn risk, tag high-risk accounts, surface intervention requests |

---

## Quick Start

```bash
# 1. Install the base kit first (required by all others)
npx journey install humaie/headless-crm-connect

# 2. Install any workflows you need
npx journey install humaie/pipeline-brief
npx journey install humaie/lead-qualification
npx journey install humaie/contact-enrichment
npx journey install humaie/deal-closer
npx journey install humaie/follow-up-sequences
npx journey install humaie/meeting-prep
npx journey install humaie/onboarding-trigger
npx journey install humaie/churn-detection
npx journey install humaie/inbound-router
npx journey install humaie/weekly-sales-review
npx journey install humaie/sales-coach
npx journey install humaie/proposal-generator
npx journey install humaie/activity-summariser
```

---

## Kit Details

### headless-crm-connect
**`humaie/headless-crm-connect`** · *Install this first*

Wire any agent to a running Headless CRM instance in under 60 seconds. Unlocks 29 typed MCP tools across contacts, companies, deals, cases, activities, pipelines, approvals, and memory.

---

### pipeline-brief
**`humaie/pipeline-brief`** · *Requires: headless-crm-connect*

Scheduled daily digest delivered to Telegram, Slack, or email. Shows total pipeline value, deals by stage, stale deals, and pending approvals. Read-only.

---

### weekly-sales-review
**`humaie/weekly-sales-review`** · *Requires: headless-crm-connect*

Monday morning narrative covering the full previous week: deals won and lost, new deals, pipeline movement, stage regressions, top activity counts, and a 7-day forecast.

---

### activity-summariser
**`humaie/activity-summariser`** · *Requires: headless-crm-connect*

On demand, generates a concise summary for any contact, company, or deal. Includes a relationship health score (0–100), key milestones, last interaction, and open items. Brief or detailed output mode.

---

### meeting-prep
**`humaie/meeting-prep`** · *Requires: headless-crm-connect*

Given a contact name or email, generates a pre-meeting brief: who they are, company background, deal status, last three interactions, open items, and suggested talking points grounded in actual CRM data.

---

### lead-qualification
**`humaie/lead-qualification`** · *Requires: headless-crm-connect*

Picks up unscored contacts, researches each company, scores leads 0–100 against your ICP criteria, and requests human approval before advancing high-value leads.

---

### contact-enrichment
**`humaie/contact-enrichment`** · *Requires: headless-crm-connect*

Finds contacts and companies with missing fields and fills them from public sources. Uses the non-destructive `/enrich` endpoint — existing data is never overwritten.

---

### inbound-router
**`humaie/inbound-router`** · *Requires: headless-crm-connect*

Processes newly created contacts not yet assigned to a pipeline. Applies configurable routing rules to assign them to the right pipeline and stage, creates a deal record, and requests approval for high-value inbound leads.

---

### follow-up-sequences
**`humaie/follow-up-sequences`** · *Requires: headless-crm-connect*

Finds contacts and deals with no activity in N days and drafts personalised follow-up notes based on deal stage and last interaction type. Skips contacts tagged `do-not-contact`.

---

### deal-closer
**`humaie/deal-closer`** · *Requires: headless-crm-connect*

Surfaces deals approaching their expected close date or stalled in the same stage, ranked by urgency score. Requests human approval to advance or close high-priority deals.

---

### proposal-generator
**`humaie/proposal-generator`** · *Requires: headless-crm-connect*

Given a deal ID or contact name, generates a tailored proposal outline: executive summary, problem statement, proposed solution, pricing tier recommendation, and next steps. Logs as an activity. Always outputs for human review — never sends automatically.

---

### onboarding-trigger
**`humaie/onboarding-trigger`** · *Requires: headless-crm-connect*

Watches for deals moved to Closed Won and kicks off an onboarding checklist: creates follow-up tasks, applies an onboarding tag, logs a welcome activity, and requests approval to send a welcome message. Duplicate-run safe.

---

### sales-coach
**`humaie/sales-coach`** · *Requires: headless-crm-connect*

Flags four problem patterns: no next step logged, slow response to inbound, stuck in stage longer than average, and no call or meeting on record. Generates a prioritised coaching brief with specific suggestions per deal.

---

### churn-detection
**`humaie/churn-detection`** · *Requires: headless-crm-connect*

Monitors customers for churn signals: inactivity, contract end date approaching, low engagement. Scores each 0–100 for churn risk, tags high-risk accounts, and requests human intervention for the worst cases.

---

## Submission

Kits are published to Journey Kits under the `humaie` publisher account.

To update a kit: edit `kit.md` and `SKILL.md`, bump the version, commit and push.

---

## Support

- Issues: [github.com/Cam-Smith-One/Headless_CRM/issues](https://github.com/Cam-Smith-One/Headless_CRM/issues)
- Email: hello@humaie.com
- Dashboard: [humaie.com](https://humaie.com)

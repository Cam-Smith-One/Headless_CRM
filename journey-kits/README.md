# Headless CRM — Journey Kits

Four installable agent workflow kits for [Headless CRM](https://github.com/Cam-Smith-One/Headless_CRM) on the [Journey Kits registry](https://www.journeykits.ai).

---

## Kits

### 1. `headless-crm-connect` ← Start here

Wire any AI agent (Claude Code, Cursor, Codex, OpenClaw, etc.) into a running Headless CRM instance via MCP. Instantly unlocks 29 typed CRM tools.

```bash
# Via Journey Kits
npx journey install humaie/headless-crm-connect
```

**What you get:** Full MCP access to contacts, companies, deals, cases, activities, pipelines, approvals, and agent memory.

---

### 2. `pipeline-brief`

Daily digest of pipeline value by stage, stale deals, and pending approvals. Delivered to Telegram, Slack, or email on a cron schedule.

```bash
npx journey install humaie/pipeline-brief
```

**Requires:** `headless-crm-connect`

---

### 3. `lead-qualification`

Research unscored contacts against your ICP criteria, score them 0–100, update the CRM, and flag high-scorers for human approval before advancing.

```bash
npx journey install humaie/lead-qualification
```

**Requires:** `headless-crm-connect`

---

### 4. `contact-enrichment`

Fill gaps in contacts and companies (title, LinkedIn, employee count, funding stage) from public sources using Headless CRM's non-destructive enrichment API.

```bash
npx journey install humaie/contact-enrichment
```

**Requires:** `headless-crm-connect`

---

## Quick Start (All Kits)

```bash
# 1. Clone and start Headless CRM
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh
npm run dev

# 2. Install the connection kit (in your agent workspace)
npx journey install humaie/headless-crm-connect

# 3. Install any workflows you want
npx journey install humaie/pipeline-brief
npx journey install humaie/lead-qualification
npx journey install humaie/contact-enrichment
```

---

## Submission

These kits are published to Journey Kits under the `humaie` publisher account.

To update a kit version:
1. Edit the relevant `kit.md` and `SKILL.md` in this directory
2. Bump the version in `kit.md` frontmatter
3. Commit and push
4. Publish via the Journey Kits API:
   ```bash
   curl -X POST https://www.journeykits.ai/api/publish \
     -H "Authorization: Bearer $JOURNEY_API_KEY" \
     -H "Content-Type: application/json" \
     -d @journey-kits/<kit-name>/publish.json
   ```

---

## Support

- Issues: [github.com/Cam-Smith-One/Headless_CRM/issues](https://github.com/Cam-Smith-One/Headless_CRM/issues)
- Email: hello@humaie.com
- Dashboard: [humaie.com](https://humaie.com)

#!/usr/bin/env npx tsx

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    type: { type: "string", default: "autonomous" },
    role: { type: "string", default: "operator" },
    tenant: { type: "string" },
    url: { type: "string", default: "http://localhost:3001" },
  },
});

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_API_KEY) {
  console.error("Error: ADMIN_API_KEY environment variable is required");
  process.exit(1);
}

if (!values.name || !values.tenant) {
  console.error("Usage: provision-agent --name <name> --tenant <tenantId> [--type <type>] [--role <role>] [--url <apiUrl>]");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${values.url}/api/agents/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_API_KEY!,
    },
    body: JSON.stringify({
      name: values.name,
      type: values.type,
      role: values.role,
      tenantId: values.tenant,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    console.error("Provisioning failed:", err);
    process.exit(1);
  }

  const result = await res.json();
  const apiUrl = values.url;

  console.log("\n✅ Agent provisioned successfully!\n");
  console.log("  Agent ID:  ", result.agent.id);
  console.log("  Name:      ", result.agent.name);
  console.log("  Type:      ", result.agent.type);
  console.log("  Role:      ", result.agent.role);
  console.log("  API Key:   ", result.apiKey);
  console.log("  JWT Token: ", result.token.slice(0, 40) + "...");
  console.log("\n─── Connect via MCP ───────────────────────────────\n");
  console.log("  Add to Claude Desktop (~/.claude.json):\n");
  console.log(`  {`);
  console.log(`    "mcpServers": {`);
  console.log(`      "headless-crm": {`);
  console.log(`        "url": "${apiUrl}/mcp",`);
  console.log(`        "headers": {`);
  console.log(`          "Authorization": "Bearer ${result.apiKey}"`);
  console.log(`        }`);
  console.log(`      }`);
  console.log(`    }`);
  console.log(`  }\n`);
  console.log("─── Connect via REST API ─────────────────────────\n");
  console.log(`  curl ${apiUrl}/api/contacts \\`);
  console.log(`    -H "Authorization: Bearer ${result.apiKey}"\n`);
  console.log("⚠️  Save your API key now — it won't be shown again.\n");
}

main();

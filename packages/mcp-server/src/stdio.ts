#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./index";

async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const schema = await import("@headless-crm/db");
  const { createCRM } = await import("@headless-crm/core");
  const { createAuthService } = await import("@headless-crm/auth");
  const { createEventBus } = await import("@headless-crm/events");

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  const events = createEventBus();
  const crm = createCRM(db, events);
  const auth = createAuthService(db);

  // For stdio mode, resolve agent context from env
  const token = process.env.HEADLESS_CRM_TOKEN;
  if (!token) {
    console.error("HEADLESS_CRM_TOKEN is required for stdio mode");
    process.exit(1);
  }
  const ctx = await auth.resolveContext(token);

  const server = createMCPServer({ crm, events, ctx, db });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});

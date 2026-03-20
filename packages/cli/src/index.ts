#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "3001" },
    host: { type: "string", default: "0.0.0.0" },
    "db-url": { type: "string" },
    "db-path": { type: "string", default: "./headless-crm.db" },
    "admin-key": { type: "string" },
    "jwt-secret": { type: "string", default: "headless-crm-dev-secret" },
    "redis-url": { type: "string" },
  },
});

// Set env vars from CLI args
if (values["db-url"]) process.env.DATABASE_URL = values["db-url"];
if (values["admin-key"]) process.env.ADMIN_API_KEY = values["admin-key"];
if (values["redis-url"]) process.env.REDIS_URL = values["redis-url"];
process.env.JWT_SECRET = values["jwt-secret"]!;
process.env.PORT = values.port!;

// Auto-detect: if DATABASE_URL is set, use Postgres. Otherwise SQLite.
if (!process.env.DATABASE_URL) {
  process.env.DB_TYPE = "sqlite";
  process.env.DB_PATH = values["db-path"]!;
}

console.log(`
  ┌─────────────────────────────────────────┐
  │         Headless CRM v0.1.0             │
  ├─────────────────────────────────────────┤
  │  Database: ${(process.env.DATABASE_URL ? "PostgreSQL" : `SQLite (${values["db-path"]})`).padEnd(28)}│
  │  Redis:    ${(process.env.REDIS_URL ? "Connected" : "Disabled (in-memory)").padEnd(28)}│
  │  API:      http://${values.host}:${values.port}${" ".repeat(Math.max(0, 19 - values.host!.length - values.port!.length))}│
  │  MCP:      http://${values.host}:${values.port}/mcp${" ".repeat(Math.max(0, 15 - values.host!.length - values.port!.length))}│
  └─────────────────────────────────────────┘
`);

// Import and start the server
import("../../apps/api/src/server.js").then((mod) => {
  const start = mod.start || mod.default?.start;
  if (start) {
    start({ port: parseInt(values.port!), host: values.host! });
  } else {
    console.error("Could not find start function in server module");
    process.exit(1);
  }
}).catch((e) => {
  console.error("Failed to start server:", e.message);
  process.exit(1);
});

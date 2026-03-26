#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolve } from "node:path";

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

// Set env vars from CLI args before importing the server
if (values["db-url"]) process.env.DATABASE_URL = values["db-url"];
if (values["admin-key"]) process.env.ADMIN_API_KEY = values["admin-key"];
if (values["redis-url"]) process.env.REDIS_URL = values["redis-url"];
process.env.JWT_SECRET = values["jwt-secret"]!;
process.env.PORT = values.port!;

// Auto-detect: if DATABASE_URL is set, use Postgres. Otherwise SQLite.
if (!process.env.DATABASE_URL) {
  process.env.DB_TYPE = "sqlite";
  process.env.DB_PATH = resolve(values["db-path"]!);
}

const dbLabel = process.env.DATABASE_URL ? "PostgreSQL" : `SQLite (${process.env.DB_PATH})`;
const redisLabel = process.env.REDIS_URL ? "Connected" : "Disabled (in-memory)";

console.log(`
  Headless CRM v0.1.0
  Database: ${dbLabel}
  Redis:    ${redisLabel}
  API:      http://${values.host}:${values.port}
  MCP:      http://${values.host}:${values.port}/mcp
`);

// Import and start the Hono API server
import { serve } from "@hono/node-server";
import { createApp } from "@headless-crm/api";

const app = createApp();
const port = parseInt(values.port!);
const host = values.host!;

serve({ fetch: app.fetch, port, hostname: host });
console.log(`Headless CRM running at http://${host}:${port}`);

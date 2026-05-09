#!/usr/bin/env node
import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const weakValues = new Set([
  "change-me-in-production",
  "change-me-in-production-32chars!!",
  "dev-only-change-me-in-production-32chars!!",
]);

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function checkSecret(env, key, required = true) {
  const value = env[key] || process.env[key] || "";
  if (!value) return required ? `${key} is missing` : null;
  if (value.length < 32) return `${key} should be at least 32 characters`;
  if (weakValues.has(value)) return `${key} still uses a public default`;
  return null;
}

const envText = existsSync(".env") ? await readFile(".env", "utf8") : "";
const env = parseEnv(envText);
const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL || "";
const attachmentStorage = env.ATTACHMENTS_STORAGE || process.env.ATTACHMENTS_STORAGE || "db";
const attachmentDir = path.resolve(process.cwd(), env.ATTACHMENTS_DIR || process.env.ATTACHMENTS_DIR || "storage/attachments");
const attachmentMaxBytes = Number.parseInt(env.ATTACHMENTS_MAX_BYTES || process.env.ATTACHMENTS_MAX_BYTES || "10485760", 10);
const errors = [];
const warnings = [];

if (!envText) warnings.push(".env missing; run npm run setup:sqlite or npm run setup");
for (const key of ["JWT_SECRET", "BETTER_AUTH_SECRET", "ADMIN_API_KEY"]) {
  const issue = checkSecret(env, key);
  if (issue) errors.push(issue);
}
if (!databaseUrl) {
  errors.push("DATABASE_URL is missing");
} else if (databaseUrl.startsWith("file:") || databaseUrl.startsWith("sqlite:")) {
  const sqlitePath = databaseUrl.replace(/^(?:file:|sqlite:)/, "");
  if (!existsSync(sqlitePath)) {
    errors.push(`SQLite database does not exist: ${sqlitePath}`);
  } else {
    const size = statSync(sqlitePath).size;
    if (size === 0) warnings.push(`SQLite database is empty: ${sqlitePath}`);
  }
  warnings.push("SQLite is best for solo/small-team local deploys; use Postgres for multi-process or high-write agent workloads.");
}
if (!Number.isFinite(attachmentMaxBytes) || attachmentMaxBytes <= 0) {
  errors.push("ATTACHMENTS_MAX_BYTES must be a positive integer");
}
if (attachmentStorage === "disk") {
  try {
    mkdirSync(attachmentDir, { recursive: true });
    accessSync(attachmentDir, constants.W_OK);
  } catch {
    errors.push(`Attachment directory is not writable: ${attachmentDir}`);
  }
} else {
  warnings.push("ATTACHMENTS_STORAGE is not set to disk; uploads will stay in the database.");
}
if ((env.CORS_ORIGINS || process.env.CORS_ORIGINS || "").includes("*")) {
  errors.push("CORS_ORIGINS must not include * for team or production deploys");
}
if (!env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL) {
  warnings.push("NEXT_PUBLIC_API_URL missing; browser app may not reach the API outside localhost defaults");
}

if (errors.length) {
  console.error("Self-host check failed:");
  for (const e of errors) console.error(`- ${e}`);
  if (warnings.length) {
    console.error("\nWarnings:");
    for (const w of warnings) console.error(`- ${w}`);
  }
  console.error(`\nGenerate fresh secrets with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`);
  process.exit(1);
}

console.log("Self-host check passed.");
for (const w of warnings) console.log(`Warning: ${w}`);
console.log(`Example strong secret: ${randomBytes(32).toString("base64url")}`);

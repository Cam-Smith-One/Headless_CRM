#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(repoRoot, ".env");
const standaloneServer = resolve(repoRoot, "apps/web/.next/standalone/apps/web/server.js");

function parseEnv(contents) {
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = {
  ...(existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {}),
  ...process.env,
};

const command = existsSync(standaloneServer)
  ? process.execPath
  : resolve(repoRoot, "node_modules/.bin/next");
const args = existsSync(standaloneServer)
  ? [standaloneServer]
  : ["start", "apps/web"];

const child = spawn(command, args, {
  cwd: repoRoot,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

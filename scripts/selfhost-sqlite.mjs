#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx !== -1) env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

const env = {
  ...process.env,
  ...(existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {}),
  NODE_ENV: process.env.NODE_ENV ?? "production",
};

const children = [];
function run(name, command, args) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("api", "npm", ["run", "start", "-w", "@headless-crm/api"]);
run("web", "npm", ["run", "start", "-w", "web"]);

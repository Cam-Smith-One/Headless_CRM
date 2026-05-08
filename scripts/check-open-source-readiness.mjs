#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "ROADMAP.md",
  "ARCHITECTURE.md",
  "EXTENDING_HEADLESS_CRM.md",
  "TROUBLESHOOTING.md",
  "UPGRADING.md",
  "RELEASING.md",
  "CODE_OF_CONDUCT.md",
  ".github/CODEOWNERS",
  ".github/workflows/ci.yml",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/pull_request_template.md",
];

const requiredGitignoreEntries = [
  ".env",
  ".env.local",
  "headless-crm.db",
  "headless-crm.db-wal",
  "headless-crm.db-shm",
  "backups/",
];

const requiredReadmeMentions = [
  "ARCHITECTURE.md",
  "EXTENDING_HEADLESS_CRM.md",
  "TROUBLESHOOTING.md",
  "UPGRADING.md",
  "ROADMAP.md",
  "SUPPORT.md",
  "examples/claude-desktop/mcp.json",
];

const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const errors = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(repoRoot, file))) {
    errors.push(`Missing required open-source artifact: ${file}`);
  }
}

const forbiddenTracked = tracked.filter((file) =>
  file === ".env"
  || file === ".env.local"
  || (/^\.env\..+/.test(file) && file !== ".env.example")
  || file === "headless-crm.db"
  || file === "headless-crm.db-shm"
  || file === "headless-crm.db-wal"
  || file.startsWith("backups/")
);

for (const file of forbiddenTracked) {
  errors.push(`Tracked local/runtime artifact should not be committed: ${file}`);
}

const gitignore = readFileSync(resolve(repoRoot, ".gitignore"), "utf8");
for (const entry of requiredGitignoreEntries) {
  if (!gitignore.includes(entry)) {
    errors.push(`.gitignore is missing recommended entry: ${entry}`);
  }
}

const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
for (const mention of requiredReadmeMentions) {
  if (!readme.includes(mention)) {
    warnings.push(`README does not reference ${mention}`);
  }
}

const secretAssignmentPattern = /^(JWT_SECRET|BETTER_AUTH_SECRET|ADMIN_API_KEY|RESEND_WEBHOOK_SECRET)=(.+)$/gm;
const placeholderHints = [
  "<",
  ">",
  "${",
  "example",
  "your-",
  "generate-",
  "change-me",
  "replace-me",
  "placeholder",
];

for (const file of tracked) {
  const abs = resolve(repoRoot, file);
  if (!existsSync(abs)) continue;
  let size = 0;
  try {
    size = statSync(abs).size;
  } catch {
    continue;
  }
  if (size > 1_000_000) continue;

  let text = "";
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    continue;
  }

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    errors.push(`Possible private key material committed in ${file}`);
  }

  for (const match of text.matchAll(secretAssignmentPattern)) {
    const value = match[2].trim();
    const looksLikePlaceholder = placeholderHints.some((hint) => value.toLowerCase().includes(hint.toLowerCase()));
    if (!looksLikePlaceholder && value.length >= 24) {
      errors.push(`Possible concrete ${match[1]} value committed in ${file}`);
    }
  }
}

if (errors.length) {
  console.error("Open-source readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.error("\nWarnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log("Open-source readiness check passed.");
for (const warning of warnings) {
  console.log(`Warning: ${warning}`);
}

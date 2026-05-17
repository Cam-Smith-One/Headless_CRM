import type { NextConfig } from "next";
import path from "path";
import { readFileSync } from "fs";

// ── Monorepo env loading ──────────────────────────────────────────────────────
// Next.js looks for .env in the app's own directory (apps/web/), not the
// monorepo root. Load the root .env manually so `npm run dev` from the root
// works without any extra flags. Existing env vars (e.g. platform-injected
// Vercel secrets) are NOT overwritten — this only fills in missing ones.
const rootEnvPath = path.join(__dirname, "../../.env");
try {
  const raw = readFileSync(rootEnvPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No root .env (e.g. Vercel deploy with platform env vars) — that's fine.
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the Next.js dev-mode indicator (the "N" overlay in the bottom-left)
  devIndicators: false,
  // Anchor workspace root to repo root so Next.js doesn't walk up into ~/
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Transpile monorepo packages so Next.js can bundle them
  transpilePackages: [
    "@headless-crm/api",
    "@headless-crm/core",
    "@headless-crm/db",
    "@headless-crm/auth",
    "@headless-crm/auth-web",
    "@headless-crm/events",
    "@headless-crm/mcp-server",
  ],
  serverExternalPackages: ["postgres", "ioredis", "better-sqlite3"],
};

export default nextConfig;

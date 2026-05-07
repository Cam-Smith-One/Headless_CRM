import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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

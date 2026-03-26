import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Transpile monorepo packages so Next.js can bundle them
  transpilePackages: [
    "@headless-crm/api",
    "@headless-crm/core",
    "@headless-crm/db",
    "@headless-crm/auth",
    "@headless-crm/events",
    "@headless-crm/mcp-server",
  ],
  serverExternalPackages: ["postgres", "ioredis", "better-sqlite3"],
};

export default nextConfig;

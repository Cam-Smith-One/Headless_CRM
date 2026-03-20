import { serve } from "@hono/node-server";
import { createApp } from "./app";

export function start(options: { port?: number; host?: string } = {}) {
  const app = createApp();
  const port = options.port ?? parseInt(process.env.PORT ?? "3001");
  const host = options.host ?? "0.0.0.0";

  console.log(`Headless CRM API server starting on port ${port}`);
  serve({ fetch: app.fetch, port, hostname: host });
  console.log(`Headless CRM API running at http://${host}:${port}`);
}

// Direct execution (Docker / node server.ts)
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  start();
}

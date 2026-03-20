import { createApp } from "@headless-crm/api";
import { handle } from "hono/vercel";

const app = createApp();

// Hono's handle() receives the full request URL and matches against its routes.
// The Hono app dual-mounts routes: /api/* for Next.js proxy, and /* for Docker.
// Next.js catch-all at /api/[[...route]] catches /api/* requests.
// Hono sees the full path (e.g. /api/contacts) and matches correctly.
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const PUT = handle(app);

export const runtime = "nodejs";
export const maxDuration = 30;

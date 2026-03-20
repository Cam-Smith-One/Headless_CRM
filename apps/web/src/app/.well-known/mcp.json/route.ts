import { createApp } from "@headless-crm/api";
import { handle } from "hono/vercel";

const app = createApp();

export const GET = handle(app);
export const runtime = "nodejs";

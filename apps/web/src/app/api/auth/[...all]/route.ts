import { auth } from "@headless-crm/auth-web";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);

// Must run in Node.js — uses postgres driver and crypto
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

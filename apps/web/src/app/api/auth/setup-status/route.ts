import { NextResponse } from "next/server";
import { getDb } from "@headless-crm/db";
import { users } from "@headless-crm/db";
import { count } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-process cache so middleware doesn't hammer the DB on every request
let cachedHasUsers: boolean | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function GET() {
  const now = Date.now();
  if (cachedHasUsers !== null && now < cacheExpiresAt) {
    return NextResponse.json({ hasUsers: cachedHasUsers });
  }

  try {
    const db = getDb();
    const [row] = await db.select({ count: count() }).from(users);
    cachedHasUsers = (row?.count ?? 0) > 0;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return NextResponse.json({ hasUsers: cachedHasUsers });
  } catch {
    // DB not available yet (e.g. migrations not run) — treat as no users
    return NextResponse.json({ hasUsers: false });
  }
}

/** Call this after creating the first user to bust the cache immediately */
export function invalidateSetupCache() {
  cachedHasUsers = true;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

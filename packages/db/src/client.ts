/**
 * Database client — Postgres only at runtime.
 *
 * NOTE: The repo also ships SQLite migrations + seed (see `setup-sqlite.sh`
 * and `drizzle-sqlite.config.ts`) for data-model inspection and as a target
 * for tooling. However, the runtime services (apps/api, packages/auth,
 * packages/core/services) statically import the Postgres schema, which
 * uses `defaultNow()` — generating `NOW()` SQL that SQLite cannot execute.
 *
 * Running the API server against a SQLite DATABASE_URL is therefore NOT
 * supported. To support SQLite at runtime, services would need to switch
 * schemas at boot based on the URL — a refactor the project hasn't taken
 * yet. The supported local-dev story is Postgres + Docker (`./scripts/setup.sh`)
 * or Neon Postgres + Vercel.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isSqlite(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("file:") || url.startsWith("sqlite:");
}

export function getClient() {
  if (!_client) {
    // SQLite check is best-effort — only throw if the URL is set and points
    // at a file:/sqlite: target. Missing DATABASE_URL is allowed to pass
    // through so `next build` can collect page data without a runtime DB.
    if (isSqlite()) {
      throw new Error(
        "DATABASE_URL points at SQLite (file:/sqlite:) but the runtime API only " +
          "supports Postgres. Use ./scripts/setup.sh for Postgres+Docker, or set " +
          "DATABASE_URL to a Postgres connection string. SQLite is supported only " +
          "for migrations + seed (see setup-sqlite.sh).",
      );
    }
    _client = postgres(process.env.DATABASE_URL!);
  }
  return _client;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

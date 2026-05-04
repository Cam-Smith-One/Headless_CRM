/**
 * Database client — auto-detects backend from DATABASE_URL.
 *
 *   `file:./foo.db` or `sqlite:./foo.db` → better-sqlite3 + sqlite-schema
 *   anything else                        → postgres-js + pg schema
 *
 * Both branches return a Drizzle-compatible client. The schema chosen here
 * matches the schema re-exported from `./index.ts`, so service code's table
 * imports line up with the driver.
 *
 * Service code that uses Postgres-only operators (e.g. `ilike`, JSON `->>`)
 * needs cross-backend helpers — see `ilikeCompat` in this package and the
 * notes in `./index.ts`.
 *
 * better-sqlite3 is loaded lazily via `createRequire` so Postgres-only
 * deploys (Vercel) don't pay the install/native-binding cost.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let _client: any = null;
let _db: any = null;

export function isSqlite(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("file:") || url.startsWith("sqlite:");
}

/**
 * Wrap a better-sqlite3 prepared statement so any Date / undefined params
 * passed by the caller (Drizzle) are converted to types better-sqlite3 can
 * actually bind. Without this, every service that does
 * `set({ updatedAt: new Date() })` throws "SQLite3 can only bind numbers,
 * strings, bigints, buffers, and null".
 */
function convertSqliteParam(v: any): any {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(convertSqliteParam);
  // Drizzle sometimes wraps params in objects with `.toString()` semantics —
  // pass through; better-sqlite3 will reject if it can't bind.
  return v;
}

function patchSqliteStatement(stmt: any) {
  for (const method of ["run", "get", "all", "iterate", "values", "raw", "pluck", "expand", "columns"] as const) {
    const orig = stmt[method];
    if (typeof orig !== "function") continue;
    if (method === "raw" || method === "pluck" || method === "expand" || method === "columns") {
      // These return the statement itself (chainable config) — no params to convert.
      continue;
    }
    stmt[method] = (...params: any[]) => orig.apply(stmt, params.map(convertSqliteParam));
  }
  return stmt;
}

export function getClient() {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (isSqlite()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3");
      const path = (url ?? "").replace(/^(?:file:|sqlite:)/, "") || "./headless-crm.db";
      const sqlite = new Database(path);
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      // Patch prepare() so Drizzle's Date-valued params get serialized to ISO
      // strings before better-sqlite3 sees them. Better-sqlite3 only accepts
      // primitives + Buffer + null as bind params.
      const origPrepare = sqlite.prepare.bind(sqlite);
      sqlite.prepare = (sql: string) => patchSqliteStatement(origPrepare(sql));
      _client = sqlite;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const postgresMod = require("postgres");
      const postgres = postgresMod.default ?? postgresMod;
      _client = postgres(url!);
    }
  }
  return _client;
}

export function getDb() {
  if (!_db) {
    if (isSqlite()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require("drizzle-orm/better-sqlite3");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const schema = require("./sqlite-schema");
      _db = drizzle(getClient(), { schema });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require("drizzle-orm/postgres-js");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const schema = require("./schema/index");
      _db = drizzle(getClient(), { schema });
    }
  }
  return _db;
}

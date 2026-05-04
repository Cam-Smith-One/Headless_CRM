/**
 * Cross-backend SQL helpers.
 *
 * Drizzle's tagged-template helpers are mostly identical between
 * postgres-js and better-sqlite3 backends, but a few aren't:
 *
 *   - `ilike` is Postgres-only; SQLite has no built-in
 *     case-insensitive LIKE that handles non-ASCII.
 *
 * Use the helpers in this file to write a single query that runs on both.
 */

import { sql, type SQL, type Column } from "drizzle-orm";

/**
 * Case-insensitive LIKE that works on both Postgres and SQLite.
 *
 * Implemented as `LOWER(col) LIKE LOWER(pattern)`. Both backends support
 * `LOWER` and `LIKE`. The pattern is taken literally — caller is responsible
 * for adding `%` wildcards and escaping any literal `%` / `_` they want as
 * data.
 *
 * Accepts either a column reference or a `sql` template (e.g. a concatenated
 * expression like `COALESCE(${first_name}, '') || ' ' || ${last_name}`).
 *
 * Equivalent to Drizzle's `ilike(col, pattern)` on Postgres; on SQLite it
 * gives proper case-insensitive behavior (default LIKE is ASCII-only).
 */
export function ilikeCompat(column: Column | SQL, pattern: string): SQL {
  return sql`lower(${column}) like lower(${pattern})`;
}

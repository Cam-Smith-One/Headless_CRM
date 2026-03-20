import { createSQLiteClient, type SQLiteDatabase } from "./sqlite-client";
import { getDb } from "./client";

type PostgresDatabase = ReturnType<typeof getDb>;

/**
 * TODO: The Postgres and SQLite drizzle instances have different schema types,
 * so callers currently need to handle each branch separately or cast. A future
 * improvement would be to define a unified abstract schema type that both
 * backends satisfy, letting the service layer stay fully generic.
 */

export type DatabaseInstance =
  | { db: PostgresDatabase; type: "postgres" }
  | { db: SQLiteDatabase; type: "sqlite" };

export function createDatabase(options?: {
  type?: "postgres" | "sqlite";
  url?: string;
  path?: string;
}): DatabaseInstance {
  // Explicit SQLite, or no Postgres URL available → use SQLite
  if (
    options?.type === "sqlite" ||
    (!options?.url && !process.env.DATABASE_URL)
  ) {
    return { db: createSQLiteClient(options?.path), type: "sqlite" as const };
  }

  // Postgres path
  return { db: getDb(), type: "postgres" as const };
}

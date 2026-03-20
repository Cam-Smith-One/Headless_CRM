import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./sqlite-schema";

export function createSQLiteClient(dbPath: string = "./headless-crm.db") {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type SQLiteDatabase = ReturnType<typeof createSQLiteClient>;

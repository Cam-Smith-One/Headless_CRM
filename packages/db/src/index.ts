export * from "./schema/index";
export * as sqliteSchema from "./sqlite-schema";
export { createSQLiteClient, type SQLiteDatabase } from "./sqlite-client";
export { createDatabase, type DatabaseInstance } from "./adapter";
export { getClient, getDb } from "./client";

export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

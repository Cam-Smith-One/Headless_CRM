import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getClient() {
  if (!_client) {
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

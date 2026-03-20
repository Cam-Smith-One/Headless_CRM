import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/sqlite-schema.ts",
  out: "./drizzle-sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH || "./headless-crm.db",
  },
});

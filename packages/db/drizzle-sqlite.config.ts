import { defineConfig } from "drizzle-kit";

// Resolve the SQLite db path — accept any of:
//   SQLITE_DB_PATH=/abs/path.db        (legacy)
//   DATABASE_URL=file:/abs/path.db     (preferred — same as runtime)
//   DATABASE_URL=file:./relative.db    (relative to cwd)
// Fallback: ./headless-crm.db (relative to wherever drizzle-kit is invoked)
function resolveSqlitePath(): string {
  if (process.env.SQLITE_DB_PATH) return process.env.SQLITE_DB_PATH;
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.startsWith("sqlite:")) {
    return url.replace(/^(?:file:|sqlite:)/, "");
  }
  return "./headless-crm.db";
}

export default defineConfig({
  schema: "./src/sqlite-schema.ts",
  out: "./drizzle-sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveSqlitePath(),
  },
});

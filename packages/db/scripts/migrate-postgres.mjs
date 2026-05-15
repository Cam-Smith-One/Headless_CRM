#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";

const repoRoot = resolve(import.meta.dirname, "../../..");
const drizzleDir = resolve(repoRoot, "packages/db/drizzle");
const journalPath = join(drizzleDir, "meta/_journal.json");
const BREAKPOINT = "--> statement-breakpoint";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for Postgres migrations.");
  process.exit(1);
}

if (databaseUrl.startsWith("file:") || databaseUrl.startsWith("sqlite:")) {
  console.error("Postgres migration runner cannot be used with SQLite DATABASE_URL values.");
  process.exit(1);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const sql = postgres(databaseUrl, {
  max: 1,
  onnotice: () => {},
  prepare: false,
});

function readStatements(tag) {
  const filePath = join(drizzleDir, `${tag}.sql`);
  const raw = readFileSync(filePath, "utf8");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    statements: raw
      .split(BREAKPOINT)
      .map((statement) => statement.trim())
      .filter(Boolean),
  };
}

try {
  await sql`create extension if not exists vector`;
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at numeric
    )
  `;

  const lastApplied = await sql`
    select created_at
    from drizzle.__drizzle_migrations
    order by created_at desc
    limit 1
  `;
  const lastCreatedAt = Number(lastApplied[0]?.created_at ?? 0);

  for (const entry of journal.entries) {
    if (Number(entry.when) <= lastCreatedAt) continue;

    const { hash, statements } = readStatements(entry.tag);
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }

      await tx`
        insert into drizzle.__drizzle_migrations ("hash", "created_at")
        values (${hash}, ${String(entry.when)})
      `;
    });
  }

  console.log("Postgres migrations applied.");
} finally {
  await sql.end({ timeout: 5 });
}

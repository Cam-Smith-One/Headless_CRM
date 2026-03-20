import { pgTable, text, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  color: text("color"),
  objectType: text("object_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recordTags = pgTable(
  "record_tags",
  {
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.recordId, table.recordType] }),
    index("record_tags_tag_idx").on(table.tagId),
    index("record_tags_record_idx").on(table.recordId, table.recordType),
  ]
);

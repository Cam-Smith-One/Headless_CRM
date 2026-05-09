import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { agents } from "./agents";

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    recordType: text("record_type").notNull(), // "contact" | "company" | "deal" | "case"
    recordId: text("record_id").notNull(),
    filename: text("filename").notNull(),
    url: text("url"), // disk://relative/path or future object-storage URL
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(), // original file size in bytes
    data: text("data"), // base64-encoded content for db-backed storage mode
    uploadedByAgentId: text("uploaded_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachments_tenant_idx").on(table.tenantId),
    index("attachments_record_idx").on(table.tenantId, table.recordType, table.recordId),
  ]
);

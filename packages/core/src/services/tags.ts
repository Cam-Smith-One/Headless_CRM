import { eq, and } from "drizzle-orm";
import {
  tags,
  recordTags,
  contacts,
  companies,
  deals,
  cases,
  activities,
} from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  objectType: z.string().min(1).max(50),
}).strict();

export const attachTagSchema = z.object({
  tagId: z.string().min(1),
  recordId: z.string().min(1),
  recordType: z.string().min(1).max(50),
}).strict();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type AttachTagInput = z.infer<typeof attachTagSchema>;

/**
 * Tags — categorization labels that can be attached to any CRM record.
 *
 * The data model uses two tables:
 *  - `tags`: tenant-scoped tag definitions (id, name, color, objectType).
 *  - `record_tags`: many-to-many join (tagId, recordId, recordType).
 *
 * `objectType` indicates the kind of records this tag is meant for
 * (e.g. "contacts", "deals"). It's advisory — the same tag id can be
 * attached across types as long as the join row carries the recordType.
 */
export function createTagsService(db: any, events: EventEmitter) {
  return {
    async create(ctx: CrmContext, input: CreateTagInput) {
      const parsed = createTagSchema.parse(input);
      const id = `tag_${nanoid(10)}`;
      const [record] = await db
        .insert(tags)
        .values({ id, tenantId: ctx.tenantId, ...parsed })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "tags.created",
        recordType: "tags",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });
      return record;
    },

    async list(ctx: CrmContext, objectType?: string) {
      const conditions = [eq(tags.tenantId, ctx.tenantId)];
      if (objectType) conditions.push(eq(tags.objectType, objectType));
      return db
        .select()
        .from(tags)
        .where(and(...conditions));
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, id), eq(tags.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Tag ${id} not found`);
      // Remove all attachments first to avoid dangling rows.
      await db.delete(recordTags).where(eq(recordTags.tagId, id));
      await db
        .delete(tags)
        .where(and(eq(tags.id, id), eq(tags.tenantId, ctx.tenantId)));

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "tags.deleted",
        recordType: "tags",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });
      return { deleted: true };
    },

    /**
     * Attach a tag to a record. Validates BOTH that the tag and the target
     * record belong to the caller's tenant. Without recordId tenant
     * validation an attacker could create orphan join rows pointing at
     * records they don't own.
     */
    async attach(ctx: CrmContext, input: AttachTagInput) {
      const parsed = attachTagSchema.parse(input);
      // Tenant-scope the tag.
      const tag = await this.getById(ctx, parsed.tagId);
      if (!tag) throw new Error(`Tag ${parsed.tagId} not found`);

      // Tenant-scope the target record.
      const tableForType: Record<string, any> = {
        contacts,
        companies,
        deals,
        cases,
        activities,
      };
      // Accept both singular ("contact") and plural ("contacts") forms.
      const singularToPlural: Record<string, string> = {
        contact: "contacts", company: "companies", deal: "deals",
        case: "cases", activity: "activities",
      };
      const resolvedType = singularToPlural[parsed.recordType] ?? parsed.recordType;
      const table = tableForType[resolvedType];
      if (!table) {
        throw new Error(
          `Unsupported recordType '${parsed.recordType}'. Allowed: ${Object.keys(tableForType).join(", ")}`,
        );
      }
      const [row] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, parsed.recordId), eq(table.tenantId, ctx.tenantId)))
        .limit(1);
      if (!row) throw new Error(`${resolvedType} record ${parsed.recordId} not found`);

      await db
        .insert(recordTags)
        .values({
          tagId: parsed.tagId,
          recordId: parsed.recordId,
          recordType: resolvedType,
        })
        .onConflictDoNothing();

      return { ok: true };
    },

    async detach(ctx: CrmContext, input: AttachTagInput) {
      const parsed = attachTagSchema.parse(input);
      const tag = await this.getById(ctx, parsed.tagId);
      if (!tag) throw new Error(`Tag ${parsed.tagId} not found`);

      const singularToPlural: Record<string, string> = {
        contact: "contacts", company: "companies", deal: "deals",
        case: "cases", activity: "activities",
      };
      const resolvedType = singularToPlural[parsed.recordType] ?? parsed.recordType;

      await db
        .delete(recordTags)
        .where(
          and(
            eq(recordTags.tagId, parsed.tagId),
            eq(recordTags.recordId, parsed.recordId),
            eq(recordTags.recordType, resolvedType),
          ),
        );
      return { ok: true };
    },

    /** List all tags attached to a given record. */
    async listForRecord(_ctx: CrmContext, recordType: string, recordId: string) {
      const singularToPlural: Record<string, string> = {
        contact: "contacts", company: "companies", deal: "deals",
        case: "cases", activity: "activities",
      };
      const resolvedType = singularToPlural[recordType] ?? recordType;
      // Join through record_tags. Tag rows will be filtered to caller's tenant
      // by joining on tags.tenantId.
      const rows = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          objectType: tags.objectType,
        })
        .from(recordTags)
        .innerJoin(tags, eq(recordTags.tagId, tags.id))
        .where(
          and(
            eq(recordTags.recordId, recordId),
            eq(recordTags.recordType, resolvedType),
            eq(tags.tenantId, _ctx.tenantId),
          ),
        );
      return rows;
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;

import { eq, and, sql } from "drizzle-orm";
import { ilikeCompat } from "@headless-crm/db";
import { contacts, crmEvents } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";
import type { EmbeddingsService } from "./embeddings";

export const createContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().optional(),
  statusCode: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export function createContactsService(
  db: any,
  events: EventEmitter,
  customFieldValidator?: (ctx: CrmContext, collection: string, customFields: Record<string, unknown> | undefined) => Promise<{ valid: boolean; errors: string[] }>,
  embeddingsService?: EmbeddingsService
) {
  return {
    async create(ctx: CrmContext, input: CreateContactInput) {
      const parsed = createContactSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "contacts", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const id = nanoid();

      const [record] = await db
        .insert(contacts)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          createdByAgentId: ctx.agentId,
          updatedByAgentId: ctx.agentId,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.created",
        recordType: "contacts",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      // Generate embedding asynchronously
      if (embeddingsService) {
        embeddingsService.embedContact(ctx, id).catch(() => {});
      }

      return record;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        );
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateContactInput) {
      const parsed = updateContactSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "contacts", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Contact ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes[key] = { before: (existing as any)[key], after: value };
        }
      }

      const [record] = await db
        .update(contacts)
        .set({
          ...parsed,
          updatedByAgentId: ctx.agentId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        )
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType: "contacts.updated",
          recordType: "contacts",
          recordId: id,
          agentId: ctx.agentId,
          userId: ctx.userId,
          changes,
        });
      }

      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Contact ${id} not found`);

      const [record] = await db
        .update(contacts)
        .set({ stateCode: "archived", updatedAt: new Date() })
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        )
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.deleted",
        recordType: "contacts",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { stateCode: { before: existing.stateCode, after: "archived" } },
      });

      return record;
    },

    async query(
      ctx: CrmContext,
      options: { limit?: number; offset?: number; search?: string; companyId?: string }
    ): Promise<PaginatedResult<typeof contacts.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const escapedSearch = options.search
        ? options.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
        : undefined;

      const whereCondition = and(
        eq(contacts.tenantId, ctx.tenantId),
        eq(contacts.stateCode, "active"),
        options.companyId ? eq(contacts.companyId, options.companyId) : undefined,
        escapedSearch
          ? ilikeCompat(
              sql`COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '') || ' ' || COALESCE(${contacts.email}, '')`,
              `%${escapedSearch}%`
            )
          : undefined
      );

      const data = await db
        .select()
        .from(contacts)
        .where(whereCondition)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(whereCondition);

      return {
        data,
        total: Number(count),
        limit,
        offset,
        hasMore: offset + data.length < Number(count),
      };
    },
  };
}

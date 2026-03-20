import { eq, and, ilike, sql } from "drizzle-orm";
import { cases } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";

export const createCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).default("open"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateCaseSchema = createCaseSchema.partial();

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export function createCasesService(
  db: any,
  events: EventEmitter,
  customFieldValidator?: (ctx: CrmContext, collection: string, customFields: Record<string, unknown> | undefined) => Promise<{ valid: boolean; errors: string[] }>
) {
  return {
    async create(ctx: CrmContext, input: CreateCaseInput) {
      const parsed = createCaseSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "cases", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const id = nanoid();

      const [record] = await db
        .insert(cases)
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
        eventType: "cases.created",
        recordType: "cases",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      return record;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(cases)
        .where(
          and(eq(cases.id, id), eq(cases.tenantId, ctx.tenantId))
        );
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateCaseInput) {
      const parsed = updateCaseSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "cases", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Case ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes[key] = { before: (existing as any)[key], after: value };
        }
      }

      const eventType =
        parsed.status && parsed.status !== existing.status
          ? "cases.status_changed"
          : "cases.updated";

      const resolvedAt =
        parsed.status === "resolved" && existing.status !== "resolved"
          ? new Date()
          : undefined;

      const [record] = await db
        .update(cases)
        .set({
          ...parsed,
          ...(resolvedAt ? { resolvedAt } : {}),
          updatedByAgentId: ctx.agentId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(cases.id, id), eq(cases.tenantId, ctx.tenantId))
        )
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType,
          recordType: "cases",
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
      if (!existing) throw new Error(`Case ${id} not found`);

      const [record] = await db
        .update(cases)
        .set({ status: "closed", updatedAt: new Date() })
        .where(
          and(eq(cases.id, id), eq(cases.tenantId, ctx.tenantId))
        )
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "cases.deleted",
        recordType: "cases",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { status: { before: existing.status, after: "closed" } },
      });

      return record;
    },

    async query(
      ctx: CrmContext,
      options: {
        limit?: number;
        offset?: number;
        search?: string;
        status?: string;
        priority?: string;
        contactId?: string;
        companyId?: string;
      }
    ): Promise<PaginatedResult<typeof cases.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const escapedSearch = options.search
        ? options.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
        : undefined;

      const whereCondition = and(
        eq(cases.tenantId, ctx.tenantId),
        options.status ? eq(cases.status, options.status) : undefined,
        options.priority ? eq(cases.priority, options.priority) : undefined,
        options.contactId ? eq(cases.contactId, options.contactId) : undefined,
        options.companyId ? eq(cases.companyId, options.companyId) : undefined,
        escapedSearch
          ? ilike(cases.title, `%${escapedSearch}%`)
          : undefined
      );

      const data = await db
        .select()
        .from(cases)
        .where(whereCondition)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cases)
        .where(whereCondition);

      return { data, total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },
  };
}

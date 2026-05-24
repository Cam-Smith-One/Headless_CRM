import { eq, and, sql, desc } from "drizzle-orm";
import { activities } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";

export const createActivitySchema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task", "agent_action"]),
  subject: z.string().optional(),
  body: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export function createActivitiesService(db: any, events: EventEmitter) {
  return {
    async log(ctx: CrmContext, input: CreateActivityInput) {
      const parsed = createActivitySchema.parse(input);
      const id = nanoid();

      const [record] = await db
        .insert(activities)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : new Date(),
          createdByAgentId: ctx.agentId,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "activities.created",
        recordType: "activities",
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
        .from(activities)
        .where(and(eq(activities.id, id), eq(activities.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    /** List all activities for the caller's tenant, newest-first. */
    async query(
      ctx: CrmContext,
      options: { limit?: number; offset?: number; type?: string } = {},
    ): Promise<PaginatedResult<typeof activities.$inferSelect>> {
      const limit = Math.min(options.limit ?? 50, 200);
      const offset = options.offset ?? 0;
      const where = and(
        eq(activities.tenantId, ctx.tenantId),
        options.type ? eq(activities.type, options.type as any) : undefined,
      );
      const data = await db
        .select()
        .from(activities)
        .where(where)
        .orderBy(desc(activities.occurredAt))
        .limit(limit)
        .offset(offset);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(activities)
        .where(where);
      return { data, total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },

    async getByRecord(
      ctx: CrmContext,
      recordType: "contact" | "company" | "deal",
      recordId: string,
      options: { limit?: number; offset?: number; type?: string }
    ): Promise<PaginatedResult<typeof activities.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const column =
        recordType === "contact"
          ? activities.contactId
          : recordType === "company"
            ? activities.companyId
            : activities.dealId;

      const whereCondition = and(
        eq(activities.tenantId, ctx.tenantId),
        eq(column, recordId),
        options.type ? eq(activities.type, options.type as any) : undefined
      );

      const data = await db
        .select()
        .from(activities)
        .where(whereCondition)
        .orderBy(desc(activities.occurredAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(activities)
        .where(whereCondition);

      return { data, total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },
  };
}

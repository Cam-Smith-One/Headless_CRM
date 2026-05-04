import { eq, and, desc, lt, sql } from "drizzle-orm";
import { approvals } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";

export const createApprovalSchema = z.object({
  type: z.enum(["agent_provision", "destructive_action", "bulk_operation", "escalation"]),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;

export function createApprovalsService(db: any, events: EventEmitter) {
  return {
    async request(ctx: CrmContext, input: CreateApprovalInput) {
      const parsed = createApprovalSchema.parse(input);
      const id = nanoid();

      const [record] = await db
        .insert(approvals)
        .values({
          id,
          tenantId: ctx.tenantId,
          type: parsed.type,
          title: parsed.title,
          description: parsed.description,
          metadata: parsed.metadata ?? {},
          requestedByAgentId: ctx.agentId,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "approvals.requested",
        recordType: "approvals" as any,
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
        metadata: { approvalType: parsed.type, title: parsed.title },
      });

      return record;
    },

    async list(
      ctx: CrmContext,
      options?: { status?: string; limit?: number; offset?: number }
    ) {
      // Proactively expire overdue approvals before any pending query so stale
      // records never appear as pending to callers.
      if (!options?.status || options.status === "pending") {
        await this.getExpired(ctx);
      }

      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      const conditions = [eq(approvals.tenantId, ctx.tenantId)];
      if (options?.status) {
        conditions.push(eq(approvals.status, options.status as any));
      }

      const data = await db
        .select()
        .from(approvals)
        .where(and(...conditions))
        .orderBy(desc(approvals.createdAt))
        .limit(limit)
        .offset(offset);

      return data;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.id, id), eq(approvals.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async approve(ctx: CrmContext, id: string, reviewNote?: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Approval ${id} not found`);
      if (existing.status !== "pending") throw new Error(`Approval ${id} is not pending`);
      if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) throw new Error("Approval has expired");

      // Block self-approval: an agent cannot approve its own request. Without
      // this, a developer-role agent could provision and self-activate further
      // agents, defeating the human-in-the-loop control entirely.
      if (
        ctx.agentId &&
        existing.requestedByAgentId &&
        ctx.agentId === existing.requestedByAgentId
      ) {
        throw new Error("Cannot approve your own request (self-approval is not allowed)");
      }

      const [record] = await db
        .update(approvals)
        .set({
          status: "approved",
          reviewedByUserId: ctx.userId ?? ctx.agentId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(approvals.id, id), eq(approvals.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "approvals.approved",
        recordType: "approvals" as any,
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { status: { before: "pending", after: "approved" } },
        metadata: { reviewNote },
      });

      return record;
    },

    async reject(ctx: CrmContext, id: string, reviewNote?: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Approval ${id} not found`);
      if (existing.status !== "pending") throw new Error(`Approval ${id} is not pending`);
      if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) throw new Error("Approval has expired");

      // Block self-rejection too — symmetric with approve(); a request must be
      // reviewed by someone other than the requester.
      if (
        ctx.agentId &&
        existing.requestedByAgentId &&
        ctx.agentId === existing.requestedByAgentId
      ) {
        throw new Error("Cannot reject your own request");
      }

      const [record] = await db
        .update(approvals)
        .set({
          status: "rejected",
          reviewedByUserId: ctx.userId ?? ctx.agentId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(approvals.id, id), eq(approvals.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "approvals.rejected",
        recordType: "approvals" as any,
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { status: { before: "pending", after: "rejected" } },
        metadata: { reviewNote },
      });

      return record;
    },

    async getPending(ctx: CrmContext) {
      return this.list(ctx, { status: "pending" });
    },

    async getExpired(ctx: CrmContext) {
      const now = new Date();
      const expired = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.tenantId, ctx.tenantId),
            eq(approvals.status, "pending"),
            lt(approvals.expiresAt, now)
          )
        );

      // Auto-expire them
      for (const record of expired) {
        await db
          .update(approvals)
          .set({ status: "expired", updatedAt: now })
          .where(eq(approvals.id, record.id));
      }

      return expired;
    },
  };
}

export type ApprovalsService = ReturnType<typeof createApprovalsService>;

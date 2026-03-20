import { eq, and, desc, count, sql } from "drizzle-orm";
import { notifications } from "@headless-crm/db";
import { nanoid } from "nanoid";
import type { CrmContext } from "../types";

export interface CreateNotificationInput {
  type?: "info" | "warning" | "error" | "success";
  title: string;
  message?: string;
  recordType?: string;
  recordId?: string;
  agentId?: string;
}

export function createNotificationsService(db: any) {
  return {
    async create(ctx: CrmContext, data: CreateNotificationInput) {
      const id = nanoid();
      const [record] = await db
        .insert(notifications)
        .values({
          id,
          tenantId: ctx.tenantId,
          type: data.type ?? "info",
          title: data.title,
          message: data.message,
          recordType: data.recordType,
          recordId: data.recordId,
          agentId: data.agentId ?? ctx.agentId,
        })
        .returning();
      return record;
    },

    async list(
      ctx: CrmContext,
      options?: { unreadOnly?: boolean; limit?: number; offset?: number }
    ) {
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      const conditions = [eq(notifications.tenantId, ctx.tenantId)];
      if (options?.unreadOnly) {
        conditions.push(eq(notifications.read, false));
      }

      const data = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return { data };
    },

    async markRead(ctx: CrmContext, id: string) {
      const [record] = await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(eq(notifications.id, id), eq(notifications.tenantId, ctx.tenantId))
        )
        .returning();
      return record ?? null;
    },

    async markAllRead(ctx: CrmContext) {
      const result = await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.tenantId, ctx.tenantId),
            eq(notifications.read, false)
          )
        );
      return { success: true };
    },

    async getUnreadCount(ctx: CrmContext) {
      const [row] = await db
        .select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, ctx.tenantId),
            eq(notifications.read, false)
          )
        );
      return row?.count ?? 0;
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;

import { eq, and, lte, lt, sql } from "drizzle-orm";
import { webhooks, webhookDeliveries, crmEvents } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createHmac } from "crypto";
import type { CrmContext, EventEmitter } from "../types";

export const createWebhookSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string()).min(1),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

function matchesEventType(pattern: string, eventType: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    return eventType.startsWith(pattern.slice(0, -1));
  }
  return pattern === eventType;
}

export function createWebhooksService(db: any, events: EventEmitter) {
  return {
    async register(ctx: CrmContext, input: CreateWebhookInput) {
      const parsed = createWebhookSchema.parse(input);
      const id = nanoid();
      const secret = crypto.randomUUID();

      const [record] = await db
        .insert(webhooks)
        .values({
          id,
          tenantId: ctx.tenantId,
          url: parsed.url,
          secret,
          eventTypes: parsed.eventTypes,
          active: parsed.active ?? true,
          description: parsed.description,
          createdByAgentId: ctx.agentId,
        })
        .returning();

      return record;
    },

    async list(ctx: CrmContext) {
      return db
        .select()
        .from(webhooks)
        .where(eq(webhooks.tenantId, ctx.tenantId));
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateWebhookInput) {
      const parsed = updateWebhookSchema.parse(input);
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Webhook ${id} not found`);

      const [record] = await db
        .update(webhooks)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, ctx.tenantId)))
        .returning();

      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Webhook ${id} not found`);

      await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, ctx.tenantId)));

      return { success: true };
    },

    async getDeliveries(
      ctx: CrmContext,
      webhookId: string,
      options?: { status?: string; limit?: number; offset?: number }
    ) {
      const webhook = await this.getById(ctx, webhookId);
      if (!webhook) throw new Error(`Webhook ${webhookId} not found`);

      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;
      const conditions = [eq(webhookDeliveries.webhookId, webhookId)];
      if (options?.status) {
        conditions.push(eq(webhookDeliveries.status, options.status));
      }

      return db
        .select()
        .from(webhookDeliveries)
        .where(and(...conditions))
        .orderBy(sql`${webhookDeliveries.createdAt} desc`)
        .limit(limit)
        .offset(offset);
    },

    async deliver(
      webhook: typeof webhooks.$inferSelect,
      event: { id?: number; eventType: string; [key: string]: unknown }
    ) {
      const body = JSON.stringify(event);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac("sha256", webhook.secret)
        .update(timestamp + "." + body)
        .digest("hex");

      // Create delivery record
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          webhookId: webhook.id,
          eventId: event.id ?? null,
          status: "pending",
          attempts: 0,
        })
        .returning();

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Timestamp": timestamp,
            "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
            "X-CRM-Event": event.eventType as string,
            "X-Webhook-Id": webhook.id,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        const responseBody = await response.text().catch(() => "");
        const status = response.ok ? "success" : "failed";

        await db
          .update(webhookDeliveries)
          .set({
            status,
            statusCode: response.status,
            responseBody: responseBody.slice(0, 4096),
            attempts: 1,
            lastAttemptAt: new Date(),
            nextRetryAt:
              status === "failed"
                ? new Date(Date.now() + 60_000)
                : null,
          })
          .where(eq(webhookDeliveries.id, delivery.id));

        return { success: response.ok, statusCode: response.status };
      } catch (error: any) {
        await db
          .update(webhookDeliveries)
          .set({
            status: "failed",
            responseBody: error.message?.slice(0, 4096),
            attempts: 1,
            lastAttemptAt: new Date(),
            nextRetryAt: new Date(Date.now() + 60_000),
          })
          .where(eq(webhookDeliveries.id, delivery.id));

        return { success: false, error: error.message };
      }
    },

    async retryFailed(ctx: CrmContext) {
      const now = new Date();
      const pending = await db
        .select({
          delivery: webhookDeliveries,
          webhook: webhooks,
        })
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
        .where(
          and(
            eq(webhooks.tenantId, ctx.tenantId),
            eq(webhookDeliveries.status, "failed"),
            lt(webhookDeliveries.attempts, webhookDeliveries.maxAttempts),
            lte(webhookDeliveries.nextRetryAt, now)
          )
        );

      const results = await Promise.allSettled(
        pending.map(async ({ delivery, webhook }: { delivery: any; webhook: any }) => {
          // Fetch the original event to re-deliver
          let eventPayload: any = { eventType: "retry" };
          if (delivery.eventId) {
            const [evt] = await db
              .select()
              .from(crmEvents)
              .where(eq(crmEvents.id, delivery.eventId));
            if (evt) eventPayload = evt;
          }

          const body = JSON.stringify(eventPayload);
          const retryTimestamp = Math.floor(Date.now() / 1000).toString();
          const signature = createHmac("sha256", webhook.secret)
            .update(retryTimestamp + "." + body)
            .digest("hex");

          try {
            const response = await fetch(webhook.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Webhook-Timestamp": retryTimestamp,
                "X-Webhook-Signature": `t=${retryTimestamp},v1=${signature}`,
                "X-CRM-Event": eventPayload.eventType,
                "X-Webhook-Id": webhook.id,
              },
              body,
              signal: AbortSignal.timeout(10_000),
            });

            const responseBody = await response.text().catch(() => "");
            const newAttempts = delivery.attempts + 1;
            const status = response.ok
              ? "success"
              : newAttempts >= delivery.maxAttempts
                ? "failed"
                : "failed";

            await db
              .update(webhookDeliveries)
              .set({
                status: response.ok ? "success" : "failed",
                statusCode: response.status,
                responseBody: responseBody.slice(0, 4096),
                attempts: newAttempts,
                lastAttemptAt: new Date(),
                nextRetryAt:
                  !response.ok && newAttempts < delivery.maxAttempts
                    ? new Date(Date.now() + 60_000 * Math.pow(2, newAttempts))
                    : null,
              })
              .where(eq(webhookDeliveries.id, delivery.id));

            return { deliveryId: delivery.id, success: response.ok };
          } catch (error: any) {
            const newAttempts = delivery.attempts + 1;
            await db
              .update(webhookDeliveries)
              .set({
                status: "failed",
                responseBody: error.message?.slice(0, 4096),
                attempts: newAttempts,
                lastAttemptAt: new Date(),
                nextRetryAt:
                  newAttempts < delivery.maxAttempts
                    ? new Date(Date.now() + 60_000 * Math.pow(2, newAttempts))
                    : null,
              })
              .where(eq(webhookDeliveries.id, delivery.id));

            return { deliveryId: delivery.id, success: false };
          }
        })
      );

      return { retried: results.length };
    },

    /** Find active webhooks matching an event type for a tenant */
    async getMatchingWebhooks(tenantId: string, eventType: string) {
      const all = await db
        .select()
        .from(webhooks)
        .where(
          and(eq(webhooks.tenantId, tenantId), eq(webhooks.active, true))
        );

      return all.filter((wh: typeof webhooks.$inferSelect) =>
        (wh.eventTypes as string[]).some((pattern) =>
          matchesEventType(pattern, eventType)
        )
      );
    },

    matchesEventType,
  };
}

export type WebhooksService = ReturnType<typeof createWebhooksService>;

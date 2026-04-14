import { createContactsService } from "./services/contacts";
import { createCompaniesService } from "./services/companies";
import { createDealsService } from "./services/deals";
import { createActivitiesService } from "./services/activities";
import { createEmailService } from "./services/emails";
import { createCasesService } from "./services/cases";
import { createWebhooksService } from "./services/webhooks";
import { createCustomFieldsService } from "./services/custom-fields";
import { createEmbeddingsService } from "./services/embeddings";
import { createApprovalsService } from "./services/approvals";
import { createPipelinesService } from "./services/pipelines";
import { createPipelineTriggersService } from "./services/pipeline-triggers";
import { createNotificationsService } from "./services/notifications";
import type { EventEmitter } from "./types";
import { crmEvents } from "@headless-crm/db";

// Wraps the event bus to also persist events to the crm_events table
// and fan out to registered webhooks
function createPersistingEmitter(
  db: any,
  upstream: EventEmitter,
  webhooksService: ReturnType<typeof createWebhooksService>,
  notificationsService: ReturnType<typeof createNotificationsService>
): EventEmitter {
  return {
    async emit(event) {
      // Always persist to Postgres (the source of truth for the UI)
      let persistedEventId: number | undefined;
      try {
        const [inserted] = await db
          .insert(crmEvents)
          .values({
            tenantId: event.tenantId,
            eventType: event.eventType,
            recordType: event.recordType,
            recordId: event.recordId,
            agentId: event.agentId,
            userId: event.userId,
            changes: event.changes ?? {},
            metadata: event.metadata ?? {},
          })
          .returning({ id: crmEvents.id });
        persistedEventId = inserted?.id;
      } catch (e) {
        console.error("Failed to persist event:", e);
      }
      // Also emit to Redis (best-effort for real-time subscriptions)
      try {
        await upstream.emit(event);
      } catch {
        // Redis may not be available (e.g. Upstash connection issues)
      }
      // Fan out to registered webhooks (best-effort, non-blocking)
      try {
        const matching = await webhooksService.getMatchingWebhooks(
          event.tenantId,
          event.eventType
        );
        if (matching.length > 0) {
          const payload = {
            ...event,
            id: persistedEventId,
          };
          await Promise.allSettled(
            matching.map((wh: any) => webhooksService.deliver(wh, payload))
          );
        }
      } catch {
        // Webhook delivery failures should never block the main flow
      }

      // Auto-generate notifications for significant events (best-effort)
      try {
        const ctx = { tenantId: event.tenantId, agentId: event.agentId };
        const meta = (event.metadata ?? {}) as Record<string, unknown>;
        const changes = (event.changes ?? {}) as Record<string, { before?: unknown; after?: unknown }>;

        switch (event.eventType) {
          case "deals.stage_changed": {
            const after = changes.stage?.after ?? meta.stage ?? "unknown";
            await notificationsService.create(ctx, {
              type: "info",
              title: `Deal moved to ${after} stage`,
              message: meta.dealName ? `Deal "${meta.dealName}" moved to ${after}` : undefined,
              recordType: "deals",
              recordId: event.recordId,
              agentId: event.agentId,
            });
            break;
          }
          case "cases.status_changed": {
            const after = changes.status?.after ?? meta.status ?? "unknown";
            await notificationsService.create(ctx, {
              type: "info",
              title: `Case status changed to ${after}`,
              message: meta.caseTitle ? `Case "${meta.caseTitle}" status changed to ${after}` : undefined,
              recordType: "cases",
              recordId: event.recordId,
              agentId: event.agentId,
            });
            break;
          }
          case "approvals.requested": {
            const title = (meta.title as string) || "Untitled";
            await notificationsService.create(ctx, {
              type: "warning",
              title: `New approval request: ${title}`,
              recordType: "approvals",
              recordId: event.recordId,
              agentId: event.agentId,
            });
            break;
          }
          case "agents.suspended": {
            const agentName = (meta.agentName as string) || event.recordId;
            await notificationsService.create(ctx, {
              type: "error",
              title: `Agent ${agentName} was suspended`,
              recordType: "agents",
              recordId: event.recordId,
              agentId: event.agentId,
            });
            break;
          }
        }
      } catch {
        // Notification creation failures should never block the main flow
      }
    },
  };
}

export function createCRM(db: any, events: EventEmitter) {
  const webhooksServiceInstance = createWebhooksService(db, events);
  const notificationsServiceInstance = createNotificationsService(db, webhooksServiceInstance);
  const persistingEvents = createPersistingEmitter(db, events, webhooksServiceInstance, notificationsServiceInstance);
  const cfService = createCustomFieldsService(db, persistingEvents);
  const cfValidator = cfService.validate.bind(cfService);
  const embeddingsService = createEmbeddingsService(db);
  return {
    contacts: createContactsService(db, persistingEvents, cfValidator, embeddingsService),
    companies: createCompaniesService(db, persistingEvents, cfValidator, embeddingsService),
    deals: createDealsService(db, persistingEvents, cfValidator),
    activities: createActivitiesService(db, persistingEvents),
    emails: createEmailService(db, persistingEvents),
    cases: createCasesService(db, persistingEvents, cfValidator),
    webhooks: webhooksServiceInstance,
    customFields: cfService,
    embeddings: embeddingsService,
    approvals: createApprovalsService(db, persistingEvents),
    pipelines: createPipelinesService(db, persistingEvents),
    pipelineTriggers: createPipelineTriggersService(db, persistingEvents),
    notifications: notificationsServiceInstance,
  };
}

export type CRM = ReturnType<typeof createCRM>;

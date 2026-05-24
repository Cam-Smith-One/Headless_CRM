import { createRequire } from "module";

export interface CrmEventPayload {
  tenantId: string;
  eventType: string;
  recordType: string;
  recordId: string;
  agentId?: string;
  userId?: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  agentId: string;
  eventTypes: string[];
  filters?: Record<string, unknown>;
  webhookUrl: string;
  active: boolean;
}

// ---------- In-memory (Postgres-only) event bus ----------

function createInMemoryEventBus() {
  const subscriptions = new Map<string, Map<string, Subscription>>();

  return {
    async emit(event: CrmEventPayload): Promise<void> {
      const payload = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
      const subs = await this.getMatchingSubscriptions(event);
      await Promise.allSettled(subs.map((sub) => this.deliverWebhook(sub, payload)));
    },

    async subscribe(sub: Omit<Subscription, "id" | "active">): Promise<Subscription> {
      const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const subscription: Subscription = { ...sub, id, active: true };
      if (!subscriptions.has(sub.tenantId)) subscriptions.set(sub.tenantId, new Map());
      subscriptions.get(sub.tenantId)!.set(id, subscription);
      return subscription;
    },

    async unsubscribe(tenantId: string, subscriptionId: string): Promise<void> {
      subscriptions.get(tenantId)?.delete(subscriptionId);
    },

    async getMatchingSubscriptions(event: CrmEventPayload): Promise<Subscription[]> {
      const tenantSubs = subscriptions.get(event.tenantId);
      if (!tenantSubs) return [];
      return Array.from(tenantSubs.values()).filter((sub) => {
        if (!sub.active) return false;
        if (sub.eventTypes.length > 0 && !sub.eventTypes.includes(event.eventType)) {
          const matches = sub.eventTypes.some((pattern) => {
            if (pattern.endsWith(".*")) return event.eventType.startsWith(pattern.slice(0, -1));
            return pattern === event.eventType;
          });
          if (!matches) return false;
        }
        return true;
      });
    },

    async deliverWebhook(sub: Subscription, event: CrmEventPayload): Promise<void> {
      try {
        const response = await fetch(sub.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CRM-Event": event.eventType, "X-CRM-Subscription": sub.id },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) console.error(`Webhook delivery failed for ${sub.id}: ${response.status}`);
      } catch (error) {
        console.error(`Webhook delivery error for ${sub.id}:`, error);
      }
    },

    async getRecentEvents(_tenantId: string, _options: { count?: number; startId?: string }): Promise<CrmEventPayload[]> {
      // Events are persisted to Postgres via createPersistingEmitter — query via API instead
      return [];
    },
  };
}

// ---------- Redis event bus (optional, for high-throughput) ----------

function createRedisEventBus(redisUrl: string) {
  let _redis: any = null;

  // Use createRequire so the optional ioredis dependency can be loaded lazily
  // from an ESM package ("type": "module") under TypeScript 5+ and 6+, without
  // depending on the bare `require` global (which TS 6 / @types/node 25+ do not
  // expose to ESM modules).
  const nodeRequire = createRequire(import.meta.url);

  function getRedis() {
    if (!_redis) {
      try {
        const Redis = nodeRequire("ioredis");
        _redis = new Redis(redisUrl);
      } catch {
        throw new Error("ioredis is not installed. Install it with: npm install ioredis");
      }
    }
    return _redis;
  }

  const STREAM_KEY = "crm:events";
  const SUBSCRIPTIONS_KEY = "crm:subscriptions";

  return {
    async emit(event: CrmEventPayload): Promise<void> {
      const redis = getRedis();
      const payload = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
      await redis.xadd(`${STREAM_KEY}:${event.tenantId}`, "*", "data", JSON.stringify(payload));
      const subs = await this.getMatchingSubscriptions(event);
      await Promise.allSettled(subs.map((sub: Subscription) => this.deliverWebhook(sub, payload)));
    },

    async subscribe(sub: Omit<Subscription, "id" | "active">): Promise<Subscription> {
      const redis = getRedis();
      const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const subscription: Subscription = { ...sub, id, active: true };
      await redis.hset(`${SUBSCRIPTIONS_KEY}:${sub.tenantId}`, id, JSON.stringify(subscription));
      return subscription;
    },

    async unsubscribe(tenantId: string, subscriptionId: string): Promise<void> {
      const redis = getRedis();
      await redis.hdel(`${SUBSCRIPTIONS_KEY}:${tenantId}`, subscriptionId);
    },

    async getMatchingSubscriptions(event: CrmEventPayload): Promise<Subscription[]> {
      const redis = getRedis();
      const all = await redis.hgetall(`${SUBSCRIPTIONS_KEY}:${event.tenantId}`);
      return Object.values(all)
        .map((raw: any) => JSON.parse(raw) as Subscription)
        .filter((sub) => {
          if (!sub.active) return false;
          if (sub.eventTypes.length > 0 && !sub.eventTypes.includes(event.eventType)) {
            const matches = sub.eventTypes.some((pattern) => {
              if (pattern.endsWith(".*")) return event.eventType.startsWith(pattern.slice(0, -1));
              return pattern === event.eventType;
            });
            if (!matches) return false;
          }
          return true;
        });
    },

    async deliverWebhook(sub: Subscription, event: CrmEventPayload): Promise<void> {
      try {
        const response = await fetch(sub.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CRM-Event": event.eventType, "X-CRM-Subscription": sub.id },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) console.error(`Webhook delivery failed for ${sub.id}: ${response.status}`);
      } catch (error) {
        console.error(`Webhook delivery error for ${sub.id}:`, error);
      }
    },

    async getRecentEvents(tenantId: string, options: { count?: number; startId?: string }): Promise<CrmEventPayload[]> {
      const redis = getRedis();
      const results = await redis.xrevrange(`${STREAM_KEY}:${tenantId}`, "+", options.startId ?? "-", "COUNT", options.count ?? 50);
      return results.map(([, fields]: [string, string[]]) => JSON.parse(fields[1]) as CrmEventPayload);
    },
  };
}

// ---------- Factory ----------

export function createEventBus(redisUrl?: string) {
  if (redisUrl) {
    console.log("[events] Using Redis event bus");
    return createRedisEventBus(redisUrl);
  }
  console.log("[events] Using in-memory event bus (Postgres-only mode)");
  return createInMemoryEventBus();
}

export type EventBus = ReturnType<typeof createEventBus>;

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationsService } from "../services/notifications";

const ctx = { tenantId: "tenant_test", agentId: "agent_1", role: "operator" as const };

function makeDb(overrides: Partial<{ returning: any }> = {}) {
  const defaultRecord = {
    id: "notif_1",
    tenantId: ctx.tenantId,
    type: "info",
    title: "Test notification",
    read: false,
  };

  return {
    insert: () => ({
      values: () => ({
        returning: async () => [overrides.returning ?? defaultRecord],
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ ...defaultRecord, read: true }],
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => [defaultRecord],
            }),
          }),
        }),
      }),
    }),
  };
}

describe("createNotificationsService", () => {
  it("creates a notification and returns it", async () => {
    const db = makeDb();
    const service = createNotificationsService(db as any);

    const result = await service.create(ctx, { title: "Hello" });
    expect(result).toBeDefined();
    expect(result.title).toBe("Test notification"); // from mock
  });

  it("fans out to matching webhooks after creation", async () => {
    const db = makeDb();
    const mockWebhooks = {
      getMatchingWebhooks: vi.fn().mockResolvedValue([{ id: "wh_1", url: "https://example.com" }]),
      deliver: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = createNotificationsService(db as any, mockWebhooks);
    await service.create(ctx, { title: "Alert", type: "warning" });

    expect(mockWebhooks.getMatchingWebhooks).toHaveBeenCalledWith(
      ctx.tenantId,
      "notifications.created"
    );
    expect(mockWebhooks.deliver).toHaveBeenCalledOnce();
  });

  it("does not fan out when no matching webhooks", async () => {
    const db = makeDb();
    const mockWebhooks = {
      getMatchingWebhooks: vi.fn().mockResolvedValue([]),
      deliver: vi.fn(),
    };

    const service = createNotificationsService(db as any, mockWebhooks);
    await service.create(ctx, { title: "Quiet" });

    expect(mockWebhooks.deliver).not.toHaveBeenCalled();
  });

  it("webhook fan-out failure does not throw", async () => {
    const db = makeDb();
    const mockWebhooks = {
      getMatchingWebhooks: vi.fn().mockRejectedValue(new Error("Redis down")),
      deliver: vi.fn(),
    };

    const service = createNotificationsService(db as any, mockWebhooks);
    // Should resolve without throwing even though webhook lookup failed
    await expect(service.create(ctx, { title: "Resilient" })).resolves.toBeDefined();
  });

  it("works without a webhooks service (backwards compatible)", async () => {
    const db = makeDb();
    const service = createNotificationsService(db as any);
    const result = await service.create(ctx, { title: "No webhooks" });
    expect(result).toBeDefined();
  });

  it("marks a notification as read", async () => {
    const db = makeDb();
    const service = createNotificationsService(db as any);
    const result = await service.markRead(ctx, "notif_1");
    expect(result?.read).toBe(true);
  });

  it("returns unread count", async () => {
    const db = {
      ...makeDb(),
      select: () => ({
        from: () => ({
          where: () => [{ count: 5 }],
        }),
      }),
    };
    const service = createNotificationsService(db as any);
    const count = await service.getUnreadCount(ctx);
    expect(count).toBe(5);
  });
});

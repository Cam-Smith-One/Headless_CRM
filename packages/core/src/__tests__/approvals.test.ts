import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApprovalsService } from "../services/approvals";

// ---------------------------------------------------------------------------
// Minimal db mock — returns chainable query builder stubs
// ---------------------------------------------------------------------------
function makeDb() {
  const rows: Record<string, any[]> = { approvals: [] };

  const chainable = (result: any) => ({
    values: () => chainable(result),
    set: () => chainable(result),
    where: () => chainable(result),
    orderBy: () => chainable(result),
    limit: () => chainable(result),
    offset: () => chainable(result),
    returning: async () => result,
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  });

  return {
    _rows: rows,
    insert: (_table: any) => ({ values: (vals: any) => ({ returning: async () => [{ ...vals, createdAt: new Date(), updatedAt: new Date(), status: vals.status ?? "pending" }] }) }),
    update: (_table: any) => ({ set: (vals: any) => ({ where: (_cond: any) => ({ returning: async () => [{ ...vals }] }) }) }),
    select: () => ({ from: (_t: any) => ({ where: (_c: any) => ({ orderBy: () => ({ limit: () => ({ offset: () => rows.approvals }) }) }) }) }),
  };
}

const mockEvents = { emit: vi.fn().mockResolvedValue(undefined) };

const ctx = { tenantId: "tenant_test", agentId: "agent_1", role: "operator" as const };

describe("createApprovalsService", () => {
  let db: ReturnType<typeof makeDb>;
  let service: ReturnType<typeof createApprovalsService>;

  beforeEach(() => {
    db = makeDb();
    service = createApprovalsService(db, mockEvents);
    vi.clearAllMocks();
  });

  it("creates an approval request and emits an event", async () => {
    const result = await service.request(ctx, {
      type: "destructive_action",
      title: "Delete all contacts",
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("Delete all contacts");
    expect(result.type).toBe("destructive_action");
    expect(mockEvents.emit).toHaveBeenCalledOnce();
    expect(mockEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "approvals.requested" })
    );
  });

  it("rejects invalid approval types", async () => {
    await expect(
      service.request(ctx, { type: "invalid_type" as any, title: "Bad" })
    ).rejects.toThrow();
  });

  it("rejects an approval and emits rejected event", async () => {
    // Simulate a pending approval in the db
    const pendingApproval = {
      id: "apv_1",
      tenantId: ctx.tenantId,
      status: "pending",
      expiresAt: null,
    };
    db._rows.approvals = [pendingApproval];

    // Patch getById to return the pending record
    vi.spyOn(service, "getById").mockResolvedValue(pendingApproval as any);

    const result = await service.reject(ctx, "apv_1", "Not approved");

    expect(mockEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "approvals.rejected" })
    );
  });

  it("throws when approving an already-approved record", async () => {
    vi.spyOn(service, "getById").mockResolvedValue({
      id: "apv_1",
      status: "approved",
      expiresAt: null,
    } as any);

    await expect(service.approve(ctx, "apv_1")).rejects.toThrow("not pending");
  });

  it("throws when acting on an expired approval", async () => {
    vi.spyOn(service, "getById").mockResolvedValue({
      id: "apv_1",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    } as any);

    await expect(service.approve(ctx, "apv_1")).rejects.toThrow("expired");
  });

  it("blocks self-approval — requester cannot approve their own request", async () => {
    vi.spyOn(service, "getById").mockResolvedValue({
      id: "apv_self",
      status: "pending",
      expiresAt: null,
      requestedByAgentId: ctx.agentId, // same as the caller
    } as any);

    await expect(service.approve(ctx, "apv_self")).rejects.toThrow(
      /self-approval is not allowed/i,
    );
  });

  it("blocks self-rejection — requester cannot reject their own request", async () => {
    vi.spyOn(service, "getById").mockResolvedValue({
      id: "apv_self",
      status: "pending",
      expiresAt: null,
      requestedByAgentId: ctx.agentId,
    } as any);

    await expect(service.reject(ctx, "apv_self")).rejects.toThrow(
      /cannot reject your own request/i,
    );
  });

  it("allows approval when reviewer differs from requester", async () => {
    vi.spyOn(service, "getById").mockResolvedValue({
      id: "apv_other",
      status: "pending",
      expiresAt: null,
      requestedByAgentId: "agent_OTHER", // different agent
    } as any);

    const result = await service.approve(ctx, "apv_other");
    expect(mockEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "approvals.approved" }),
    );
    expect(result).toBeDefined();
  });

  it("getExpired marks overdue pending approvals as expired", async () => {
    const expiredRecord = {
      id: "apv_expired",
      tenantId: ctx.tenantId,
      status: "pending",
      expiresAt: new Date(Date.now() - 60_000),
    };

    // Override select to return the expired record for the expiry query
    const updateSpy = vi.fn().mockReturnValue({
      set: () => ({ where: () => Promise.resolve() }),
    });
    db.update = updateSpy;

    // Override select to return expired record for the getExpired query
    db.select = () => ({
      from: () => ({
        where: () => [expiredRecord],
      }),
    }) as any;

    const expired = await service.getExpired(ctx);
    expect(Array.isArray(expired)).toBe(true);
  });

  it("list auto-expires pending approvals before returning", async () => {
    const getExpiredSpy = vi.spyOn(service, "getExpired").mockResolvedValue([]);
    await service.list(ctx, { status: "pending" });
    expect(getExpiredSpy).toHaveBeenCalledOnce();
  });

  it("list skips auto-expire when filtering for non-pending status", async () => {
    const getExpiredSpy = vi.spyOn(service, "getExpired").mockResolvedValue([]);
    await service.list(ctx, { status: "approved" });
    expect(getExpiredSpy).not.toHaveBeenCalled();
  });
});

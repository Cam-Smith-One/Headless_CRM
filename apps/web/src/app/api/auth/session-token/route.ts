/**
 * Session-Token Bridge
 *
 * Exchanges a valid Better Auth session cookie for an agent JWT that the
 * browser can use to call the Hono CRM API. Called once after login.
 *
 * Returns: { token: string } — a 30-day agent JWT stored in localStorage
 * as hcrm_token, exactly as the manual flow worked before auth was added.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { createAuthService } from "@headless-crm/auth";
import { getDb } from "@headless-crm/db";
import { agents, users } from "@headless-crm/db";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDashboardRole(role: "owner" | "admin" | "member") {
  return role === "owner" || role === "admin" ? "developer" : "reader";
}

export async function GET(request: NextRequest) {
  // Validate the Better Auth session
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const db = getDb();

  // Query DB directly — the Better Auth session cookie may be cached for up to
  // 5 minutes, so user.tenantId from the session can be stale (e.g. right after
  // invite accept sets tenantId). Always read the fresh user record.
  const [freshUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!freshUser?.tenantId) {
    return NextResponse.json({ error: "User has no tenant assigned" }, { status: 400 });
  }

  const authService = createAuthService(db);

  // Find or create the dashboard agent for this user
  const dashboardAgentName = `dashboard:${freshUser.id}`;
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.ownerUserId, freshUser.id), eq(agents.tenantId, freshUser.tenantId)))
    .limit(1);

  let agentId: string;
  let agentRole: "reader" | "operator" | "developer" | "auditor";
  const desiredRole = getDashboardRole(freshUser.role);

  if (existingAgent) {
    agentId = existingAgent.id;
    agentRole = desiredRole;
    if (existingAgent.role !== desiredRole || existingAgent.status !== "active") {
      await db
        .update(agents)
        .set({
          role: desiredRole,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(agents.id, existingAgent.id));
    }
  } else {
    // Provision a new dashboard agent scoped to this user's tenant
    const provisionRole = desiredRole === "developer" ? "operator" : desiredRole;

    // Use admin key bypass — we are already authenticated as a human user
    const result = await authService.provisionAgent(freshUser.tenantId, {
      name: dashboardAgentName,
      type: "supervised",
      role: provisionRole,
      ownerUserId: freshUser.id,
    });
    agentId = result.agent.id;
    if (provisionRole !== desiredRole) {
      await db
        .update(agents)
        .set({
          role: desiredRole,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));
    } else if (result.agent.status !== "active") {
      await authService.activateAgent(freshUser.tenantId, agentId);
    }
    agentRole = desiredRole;
  }

  // Issue a fresh 30-day JWT for this agent
  const token = await authService.createToken({
    agentId,
    tenantId: freshUser.tenantId,
    role: agentRole,
  });

  return NextResponse.json({ token });
}

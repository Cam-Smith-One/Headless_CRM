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
import { agents } from "@headless-crm/db";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Validate the Better Auth session
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { user } = session;
  if (!user.tenantId) {
    return NextResponse.json({ error: "User has no tenant assigned" }, { status: 400 });
  }

  const db = getDb();
  const authService = createAuthService(db);

  // Find or create the dashboard agent for this user
  const dashboardAgentName = `dashboard:${user.id}`;
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.ownerUserId, user.id), eq(agents.tenantId, user.tenantId)))
    .limit(1);

  let agentId: string;
  let agentRole: "reader" | "operator" | "developer" | "auditor";

  if (existingAgent) {
    agentId = existingAgent.id;
    agentRole = (existingAgent.role as any) ?? "operator";
  } else {
    // Provision a new dashboard agent scoped to this user's tenant
    const dashboardRole =
      user.role === "owner" || user.role === "admin" ? "developer" : "operator";

    // Use admin key bypass — we are already authenticated as a human user
    const result = await authService.provisionAgent(user.tenantId, {
      name: dashboardAgentName,
      type: "supervised",
      role: dashboardRole,
      ownerUserId: user.id,
    });
    agentId = result.agent.id;
    agentRole = dashboardRole;
  }

  // Issue a fresh 30-day JWT for this agent
  const token = await authService.createToken({
    agentId,
    tenantId: user.tenantId,
    role: agentRole,
  });

  return NextResponse.json({ token });
}

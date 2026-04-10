/**
 * POST /api/auth/setup
 *
 * Called after the first user signs up via Better Auth on the /setup page.
 * Promotes the user to "owner" role and creates/associates their tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { getDb } from "@headless-crm/db";
import { users, tenants } from "@headless-crm/db";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const db = getDb();

  // Safety: only allow if there's exactly one user (the one just created)
  const [{ count: userCount }] = await db.select({ count: count() }).from(users);
  if (userCount > 1) {
    return NextResponse.json(
      { error: "Setup already complete" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const workspaceName: string = body.workspace || `${session.user.name}'s Workspace`;
  const slug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  // Create tenant
  const tenantId = `tenant_${nanoid(10)}`;
  await db.insert(tenants).values({
    id: tenantId,
    name: workspaceName,
    slug,
  });

  // Promote user to owner + assign tenant
  await db
    .update(users)
    .set({ role: "owner", tenantId, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true, tenantId });
}

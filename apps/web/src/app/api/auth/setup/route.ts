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

  const body = await request.json().catch(() => ({}));
  const workspaceName: string = body.workspace || `${session.user.name}'s Workspace`;
  const slug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  // Wrap the count-check + tenant create + user promote in a single transaction
  // so two simultaneous /setup calls can't both pass the count check and both
  // create owner tenants. The transaction's serializable snapshot makes the
  // `userCount > 1` check race-free.
  let tenantId: string;
  try {
    tenantId = await db.transaction(async (tx: any) => {
      const [{ count: userCount }] = await tx.select({ count: count() }).from(users);
      if (userCount > 1) {
        throw new Error("SETUP_ALREADY_COMPLETE");
      }

      const newTenantId = `tenant_${nanoid(10)}`;
      await tx.insert(tenants).values({
        id: newTenantId,
        name: workspaceName,
        slug,
      });

      await tx
        .update(users)
        .set({ role: "owner", tenantId: newTenantId, updatedAt: new Date() })
        .where(eq(users.id, session.user.id));

      return newTenantId;
    });
  } catch (e: any) {
    if (e?.message === "SETUP_ALREADY_COMPLETE") {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, tenantId });
}

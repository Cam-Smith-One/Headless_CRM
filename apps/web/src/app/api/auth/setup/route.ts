/**
 * POST /api/auth/setup
 *
 * Called after the first user signs up via Better Auth on the /setup page.
 * Promotes the user to "owner" role and creates/associates their tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { getDb, isSqlite } from "@headless-crm/db";
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

  // Race-safe setup. Postgres path uses an async transaction (snapshot makes
  // the count check race-free). SQLite (better-sqlite3) doesn't support async
  // transaction callbacks; instead we rely on better-sqlite3's serial-write
  // model + WAL — concurrent /setup calls hit the file lock one at a time,
  // and any second writer sees `userCount > 1` and is rejected.
  let tenantId: string;
  const newTenantId = `tenant_${nanoid(10)}`;

  if (isSqlite()) {
    // Sequential check-and-act on SQLite. Single-process WAL mode means the
    // count + insert + update execute serially per-connection.
    const [{ count: userCount }] = await db.select({ count: count() }).from(users);
    if (userCount > 1) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
    }
    await db.insert(tenants).values({ id: newTenantId, name: workspaceName, slug });
    await db
      .update(users)
      .set({ role: "owner", tenantId: newTenantId, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
    tenantId = newTenantId;
  } else {
    try {
      tenantId = await db.transaction(async (tx: any) => {
        const [{ count: userCount }] = await tx.select({ count: count() }).from(users);
        if (userCount > 1) {
          throw new Error("SETUP_ALREADY_COMPLETE");
        }

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
  }

  return NextResponse.json({ ok: true, tenantId });
}

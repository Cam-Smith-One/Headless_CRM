import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { getDb } from "@headless-crm/db";
import { users, invites } from "@headless-crm/db";
import { eq, and, gt, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.tenantId) {
    return NextResponse.json({ members: [], invites: [] });
  }

  const db = getDb();

  const [members, pendingInvites] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, user.tenantId)),

    db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.tenantId, user.tenantId),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, new Date())
        )
      ),
  ]);

  return NextResponse.json({ members, invites: pendingInvites });
}

/**
 * POST /api/auth/invite/accept
 * Called after signup to mark the invite as accepted and assign the tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { getDb } from "@headless-crm/db";
import { invites, users } from "@headless-crm/db";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const db = getDb();
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), gt(invites.expiresAt, new Date())));

  if (!invite || invite.acceptedAt) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }

  // Assign user to the tenant with the invited role
  await db
    .update(users)
    .set({
      role: invite.role as any,
      tenantId: invite.tenantId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  // Mark invite accepted
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.token, token));

  return NextResponse.json({ ok: true });
}

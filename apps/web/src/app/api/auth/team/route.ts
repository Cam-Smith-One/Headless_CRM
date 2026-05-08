import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@headless-crm/db";
import { users, invites } from "@headless-crm/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getFreshSessionUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getFreshSessionUser(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
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

export async function PATCH(request: NextRequest) {
  const user = await getFreshSessionUser(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Only owners can change team roles" }, { status: 403 });
  }
  if (!user.tenantId) {
    return NextResponse.json({ error: "User has no tenant assigned" }, { status: 400 });
  }

  const body = await request.json();
  const { memberId, role } = body ?? {};
  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Role must be admin or member" }, { status: 400 });
  }
  if (memberId === user.id) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db
    .select({
      id: users.id,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(and(eq(users.id, memberId), eq(users.tenantId, user.tenantId)))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 403 });
  }

  await db
    .update(users)
    .set({ role: role as "admin" | "member", updatedAt: new Date() })
    .where(eq(users.id, target.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getFreshSessionUser(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!user.tenantId) {
    return NextResponse.json({ error: "User has no tenant assigned" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;
  const memberId = typeof body?.memberId === "string" ? body.memberId : null;
  const db = getDb();

  if (inviteId) {
    if (!["owner", "admin"].includes(user.role)) {
      return NextResponse.json({ error: "Only owners and admins can revoke invites" }, { status: 403 });
    }

    const deleted = await db
      .delete(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.tenantId, user.tenantId), isNull(invites.acceptedAt)))
      .returning({ id: invites.id });

    if (!deleted.length) {
      return NextResponse.json({ error: "Pending invite not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  }

  if (memberId) {
    if (user.role !== "owner") {
      return NextResponse.json({ error: "Only owners can remove team members" }, { status: 403 });
    }
    if (memberId === user.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
    }

    const [target] = await db
      .select({
        id: users.id,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, memberId), eq(users.tenantId, user.tenantId)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "Owner cannot be removed" }, { status: 403 });
    }

    await db
      .update(users)
      .set({
        tenantId: null,
        role: "member",
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide inviteId or memberId" }, { status: 400 });
}

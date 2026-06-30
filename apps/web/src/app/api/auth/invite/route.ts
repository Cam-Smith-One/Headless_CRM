/**
 * GET  /api/auth/invite?token=<token>  — validate an invite token
 * POST /api/auth/invite                — create a new invite (admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@headless-crm/auth-web";
import { getDb } from "@headless-crm/db";
import { invites } from "@headless-crm/db";
import { eq, and, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validate an invite token — called by the /signup page */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const db = getDb();
  const [invite] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.token, token),
        gt(invites.expiresAt, new Date()),
      )
    );

  if (!invite) {
    return NextResponse.json(
      { error: "Invite link is invalid or has expired" },
      { status: 404 }
    );
  }

  if (invite.acceptedAt) {
    return NextResponse.json(
      { error: "This invite has already been used" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    tenantId: invite.tenantId,
  });
}

/** Create an invite — requires admin or owner role */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = session.user as any;
  if (!["owner", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const [invite] = await db
    .insert(invites)
    .values({
      id: nanoid(),
      email,
      role,
      tenantId: user.tenantId,
      invitedByUserId: user.id,
      token,
      expiresAt,
    })
    .returning();

  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/signup?token=${token}`;

  // If Resend is configured, send the invite email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "crm@headless-crm.dev",
          to: email,
          subject: `${session.user.name} invited you to Headless CRM`,
          html: `<p>You've been invited to join as a <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept invite</a></p><p>This link expires in 48 hours.</p>`,
        }),
      });
    } catch {
      // Email sending is best-effort — don't fail the invite creation
    }
  }

  return NextResponse.json({ invite: { ...invite, token: undefined }, inviteUrl });
}

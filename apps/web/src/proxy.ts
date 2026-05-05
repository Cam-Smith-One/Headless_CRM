import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection proxy (HUMAN UI ONLY).
 *
 * API, MCP, health, discovery, and webhook routes bypass this cookie check
 * because their own handlers enforce bearer/session auth. UI routes require
 * the Better Auth session cookie and redirect anonymous humans to /login.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/signup",
  "/_next",
  "/favicon.ico",
  "/api/",
  "/health",
  "/ready",
  "/mcp",
  "/.well-known/",
  "/webhooks/",
];

const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

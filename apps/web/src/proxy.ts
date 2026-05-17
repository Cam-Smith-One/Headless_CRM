import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware (HUMAN UI ONLY).
 *
 * Strategy:
 *  1. Public paths and API/agent paths bypass the cookie check entirely.
 *     The Hono API at /api/* enforces its own auth (JWT bearer for agents,
 *     Better Auth session for human callers). MCP and discovery endpoints
 *     are bearer-only and must NEVER be redirected to /login.
 *  2. For UI pages, check for the Better Auth session cookie. If absent →
 *     redirect to /login.
 *  3. The /login page itself checks if any users exist; if not, redirects
 *     to /setup. This keeps the middleware edge-compatible (no DB queries
 *     here).
 *
 * The Better Auth session cookie name is "better-auth.session_token".
 * We check presence only — full signature validation happens in Server
 * Components and API routes via auth.api.getSession().
 */

// Paths the middleware lets through unconditionally. UI auth pages are here;
// API / MCP / health / discovery / webhooks all bypass because their own
// handlers enforce auth (and bearer-token clients don't carry a session
// cookie at all — redirecting them to /login breaks every external agent).
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/signup",
  "/_next",
  "/favicon.ico",
  // API + agent transports — handlers in apps/api enforce auth themselves.
  "/api/",
  "/health",
  "/mcp",
  "/.well-known/",
  "/webhooks/",
];

const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for session cookie
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
    /*
     * Match all paths except static files.
     * Excludes: _next/static, _next/image, public files with extensions.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * Strategy:
 *  1. Public paths (/login, /setup, /signup, /api/auth/*) are always allowed.
 *  2. Check for the Better Auth session cookie. If absent → redirect to /login.
 *  3. The /login page itself checks if any users exist; if not, redirects to /setup.
 *     This keeps the middleware edge-compatible (no DB queries here).
 *
 * The Better Auth session cookie name is "better-auth.session_token".
 * We check presence only — full signature validation happens in Server Components
 * and API routes via auth.api.getSession().
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/signup",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

const SESSION_COOKIE = "better-auth.session_token";

export function middleware(request: NextRequest) {
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

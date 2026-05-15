import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, isSqlite } from "@headless-crm/db";
import * as schema from "@headless-crm/db";

function withLoopbackAliases(urls: Array<string | undefined>): string[] {
  const trusted = new Set<string>();

  for (const raw of urls) {
    if (!raw) continue;
    trusted.add(raw);

    try {
      const url = new URL(raw);
      if (url.hostname === "localhost") {
        const alias = new URL(raw);
        alias.hostname = "127.0.0.1";
        trusted.add(alias.origin);
      } else if (url.hostname === "127.0.0.1") {
        const alias = new URL(raw);
        alias.hostname = "localhost";
        trusted.add(alias.origin);
      } else {
        trusted.add(url.origin);
      }
    } catch {
      // Ignore malformed values; Better Auth will validate real requests.
    }
  }

  return [...trusted];
}

const authBaseURL =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Better Auth server instance for human user authentication.
 *
 * This is separate from the agent JWT system in packages/auth, which remains
 * unchanged. This handles dashboard login for human team members.
 *
 * Providers:
 *  - Email + password: always enabled (works self-hosted with no cloud deps)
 *  - Google OAuth: enabled when GOOGLE_CLIENT_ID env var is set
 *  - GitHub OAuth: enabled when GITHUB_CLIENT_ID env var is set
 */
/**
 * Resolve the Better Auth signing secret.
 *
 * In production, BETTER_AUTH_SECRET MUST be set (>= 32 chars). Without this
 * guard, a misconfigured prod deploy would silently use a hardcoded dev
 * fallback and accept any session signed with that well-known literal.
 *
 * The check is intentionally NOT done at module load — Next.js collects page
 * data during `next build` with NODE_ENV=production, and a throw there would
 * break builds that don't have the secret in the build environment (only the
 * runtime environment). We resolve at first use of the auth handler instead;
 * the warning is logged at module load to surface misconfigs early.
 */
function resolveBetterAuthSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET;
  const weakValues = new Set([
    "change-me-in-production",
    "change-me-in-production-32chars!!",
    "dev-only-change-me-in-production-32chars!!",
  ]);
  if (fromEnv && fromEnv.length >= 32 && !(process.env.NODE_ENV === "production" && weakValues.has(fromEnv))) {
    return fromEnv;
  }
  // During `next build` (page-data collection runs in production mode),
  // NEXT_PHASE is "phase-production-build". Allow a placeholder in that
  // phase so builds don't fail; runtime will reject if the env is still
  // missing. Same applies to one-off scripts that import the module
  // before env is loaded.
  const isBuildPhase = process.env.NEXT_PHASE?.startsWith("phase-production-build");
  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    throw new Error(
      "BETTER_AUTH_SECRET is required in production, must be at least 32 chars, and cannot use a default value. " +
        "Set it to a strong random value (e.g. `openssl rand -base64 32`).",
    );
  }
  return "dev-only-change-me-in-production-32chars!!";
}

// Surface the misconfig early in non-build runtimes via a console warn.
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) &&
  !process.env.NEXT_PHASE
) {
  console.warn(
    "[auth-web] BETTER_AUTH_SECRET is missing or too short. Auth handlers will throw on first use.",
  );
}

export const auth = betterAuth({
  secret: resolveBetterAuthSecret(),
  baseURL: authBaseURL,
  trustedOrigins: withLoopbackAliases([
    authBaseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
  ]),

  // Switch the Better Auth Drizzle adapter's provider to match the active
  // backend. Without this, signup/sign-in throws against a SQLite DATABASE_URL
  // because the adapter generates Postgres-specific SQL.
  database: drizzleAdapter(getDb(), {
    provider: isSqlite() ? "sqlite" : "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
        input: false, // not settable by user on signup
      },
      tenantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh session if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache session in cookie for 5 minutes
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

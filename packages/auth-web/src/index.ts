import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@headless-crm/db";
import * as schema from "@headless-crm/db";

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
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "change-me-in-production-32chars!!",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  database: drizzleAdapter(getDb(), {
    provider: "pg",
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

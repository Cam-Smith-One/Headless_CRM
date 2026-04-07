"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client.
 * Import hooks and actions from this file in Client Components.
 *
 * Usage:
 *   import { useSession, authClient } from "@headless-crm/auth-web/client";
 *   const { data: session } = useSession();
 *   await authClient.signOut();
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});

export const {
  useSession,
  signIn,
  signOut,
  signUp,
} = authClient;

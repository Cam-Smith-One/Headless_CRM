"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client.
 * Import hooks and actions from this file in Client Components.
 *
 * Usage:
 *   import { useSession, signIn, signOut, signUp } from "@headless-crm/auth-web/client";
 *   const { data: session } = useSession();
 */
const _client = createAuthClient({
  baseURL:
    typeof globalThis.window !== "undefined"
      ? globalThis.window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});

// Export individual methods — avoids exporting the client instance directly,
// which has a complex inferred type that references better-auth internals.
export const useSession = _client.useSession;
export const signIn = _client.signIn;
export const signOut = _client.signOut;
export const signUp = _client.signUp;

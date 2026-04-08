import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Headless CRM",
};

/**
 * Minimal layout for auth pages (login, setup, signup).
 * No sidebar, no AppShell — just a centred card on a subtle background.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Headless CRM
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            The CRM built for AI agents
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

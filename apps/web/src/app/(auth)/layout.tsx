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
        {/* Logo + wordmark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Headless CRM" width={48} height={48} className="rounded-xl shadow-sm" />
          <div className="text-center">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Headless CRM
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The CRM built for AI agents
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

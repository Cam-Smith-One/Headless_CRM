import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";

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
        <Brand className="mb-8 justify-center" />
        {children}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@headless-crm/auth-web/client";

/**
 * First-run setup wizard.
 * Shown automatically (by the login page redirect) when no users exist yet.
 * Creates the first user as "owner" and auto-provisions a tenant.
 */
export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Guard: if users already exist, redirect to login
  useEffect(() => {
    fetch("/api/auth/setup-status")
      .then((r) => r.json())
      .then(({ hasUsers }) => {
        if (hasUsers) router.replace("/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Create account via Better Auth
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message ?? "Could not create account");
        return;
      }

      // 2. Call server to promote this user to owner + create tenant
      const setupRes = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspace || name + "'s Workspace" }),
      });

      if (!setupRes.ok) {
        const body = await setupRes.json().catch(() => ({}));
        setError(body.error ?? "Setup failed — try again");
        return;
      }

      // 3. Get an agent token for CRM API calls
      const tokenRes = await fetch("/api/auth/session-token");
      if (tokenRes.ok) {
        const { token } = await tokenRes.json();
        if (token) localStorage.setItem("hcrm_token", token);
      }

      router.push("/");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-base font-semibold text-card-foreground">
        Welcome to Headless CRM
      </h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Create your admin account to get started. This is shown once — when no
        users exist yet.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Your name
          </label>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="Jane Smith"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="jane@company.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Password
            <span className="ml-1 text-muted-foreground">(min. 8 characters)</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Workspace name
            <span className="ml-1 text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="Acme Corp"
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-8 w-full rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

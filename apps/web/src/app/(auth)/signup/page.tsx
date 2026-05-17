"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@headless-crm/auth-web/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    tenantId: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate invite token
  useEffect(() => {
    if (!token) {
      setInviteError("No invite token provided. Ask your admin for a new invite link.");
      return;
    }
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setInviteError(data.error);
        else setInvite(data);
      })
      .catch(() => setInviteError("Could not validate invite token"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({
        name,
        email: invite.email,
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message ?? "Could not create account");
        return;
      }

      // Mark invite as accepted
      await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      // Get CRM API token
      const tokenRes = await fetch("/api/auth/session-token");
      if (tokenRes.ok) {
        const { token: agentToken } = await tokenRes.json();
        if (agentToken) localStorage.setItem("hcrm_token", agentToken);
      }

      router.push("/");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (inviteError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-base font-semibold text-card-foreground">
          Invalid invite
        </h1>
        <p className="text-xs text-destructive">{inviteError}</p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Validating invite…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-base font-semibold text-card-foreground">
        Accept invite
      </h1>
      <p className="mb-5 text-xs text-muted-foreground">
        You&apos;ve been invited as a <strong>{invite.role}</strong>. Create your
        account to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Email
          </label>
          <input
            type="email"
            disabled
            value={invite.email}
            className="h-8 w-full rounded-lg border border-input bg-muted/30 px-2.5 text-sm text-muted-foreground"
          />
        </div>

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

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Loading…
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

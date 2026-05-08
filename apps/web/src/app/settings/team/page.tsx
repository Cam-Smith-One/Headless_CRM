"use client";

import { useState, useEffect } from "react";
import { useSession } from "@headless-crm/auth-web/client";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  inviteUrl?: string;
}

export default function TeamPage() {
  const { data: session } = useSession(); // used for current user id comparison

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [savingMemberId, setSavingMemberId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [revokingInviteId, setRevokingInviteId] = useState("");

  // Derive canManage from the fresh member list (DB-sourced) rather than the
  // Better Auth session cookie, which can be stale for up to 5 minutes after
  // a role change (e.g. right after the /setup flow promotes user to owner).
  const currentMember = members.find((m) => m.id === session?.user?.id);
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canManageRoles = currentMember?.role === "owner";
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");

  async function refreshTeam() {
    try {
      const res = await fetch("/api/auth/team");
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
    } catch {}
  }

  useEffect(() => {
    refreshTeam().finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(memberId: string, role: "admin" | "member") {
    setActionError("");
    setSavingMemberId(memberId);
    try {
      const res = await fetch("/api/auth/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not update role");
        return;
      }
      setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, role } : member)));
    } catch {
      setActionError("Something went wrong");
    } finally {
      setSavingMemberId("");
    }
  }

  async function handleRemoveMember(memberId: string) {
    setActionError("");
    setRemovingMemberId(memberId);
    try {
      const res = await fetch("/api/auth/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not remove member");
        return;
      }
      setMembers((prev) => prev.filter((member) => member.id !== memberId));
    } catch {
      setActionError("Something went wrong");
    } finally {
      setRemovingMemberId("");
    }
  }

  async function handleCancelInvite(inviteId: string) {
    setActionError("");
    setRevokingInviteId(inviteId);
    try {
      const res = await fetch("/api/auth/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not cancel invite");
        return;
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch {
      setActionError("Something went wrong");
    } finally {
      setRevokingInviteId("");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteLoading(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create invite");
        return;
      }
      setInviteResult({ url: data.inviteUrl });
      setInvites((prev) => [...prev, { id: data.invite.id, email: data.invite.email, role: data.invite.role, expiresAt: data.invite.expiresAt }]);
      setInviteEmail("");
    } catch {
      setError("Something went wrong");
    } finally {
      setInviteLoading(false);
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      member: "bg-secondary text-muted-foreground",
    };
    return (
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[role] ?? colors.member}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Team</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage team members and invite new people
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setLoading(true); refreshTeam().finally(() => setLoading(false)); }}
            className="h-8 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            Refresh
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => { setShowInviteModal(true); setInviteResult(null); setError(""); }}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Invite member
            </button>
          )}
        </div>
      </div>
      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      )}

      {/* Members list */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-secondary/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Members ({members.length})
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : members.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No members yet</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} data-member-id={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{m.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{m.email}</p>
                </div>
                {canManageRoles && m.role !== "owner" && m.id !== session?.user?.id ? (
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`member-role-${m.id}`}>Role</label>
                    <select
                      id={`member-role-${m.id}`}
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      disabled={savingMemberId === m.id || removingMemberId === m.id}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "member")}
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${m.email}`}
                      disabled={removingMemberId === m.id || savingMemberId === m.id}
                      onClick={() => handleRemoveMember(m.id)}
                      className="rounded px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {removingMemberId === m.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {roleBadge(m.role)}
                    {m.id === session?.user?.id && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <div className="bg-secondary/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invites ({invites.length})
          </div>
          <div className="divide-y divide-border">
            {invites.map((inv) => (
              <div key={inv.id} data-invite-id={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {roleBadge(inv.role)}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Cancel invite for ${inv.email}`}
                    disabled={revokingInviteId === inv.id}
                    onClick={() => handleCancelInvite(inv.id)}
                    className="rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {revokingInviteId === inv.id ? "Canceling…" : "Cancel"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Invite team member</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {process.env.NEXT_PUBLIC_SMTP_ENABLED === "true"
                ? "An invite email will be sent automatically."
                : "Copy and share the invite link — no email server required."}
            </p>

            {inviteResult ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Invite created. Share this link with your team member:
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <code className="flex-1 truncate text-[10px] text-foreground">
                    {inviteResult.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(inviteResult.url)}
                    className="flex-shrink-0 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setInviteResult(null); }}
                  className="h-8 w-full rounded-lg bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    placeholder="colleague@company.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <option value="member">Member — view CRM data</option>
                    <option value="admin">Admin — manage agents & settings</option>
                  </select>
                </div>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="h-8 flex-1 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="h-8 flex-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {inviteLoading ? "Sending…" : "Send invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

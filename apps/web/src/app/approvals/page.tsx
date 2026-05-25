"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const typeColors: Record<string, string> = {
  agent_provision: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  destructive_action: "bg-red-500/15 text-red-400 border-red-500/20",
  bulk_operation: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  escalation: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/15 text-green-400 border-green-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const POLL_INTERVAL = 5_000;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ApprovalsPage() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isFirst = useRef(true);

  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  function fetchApprovals() {
    apiFetch<any[]>("/api/approvals", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setApprovals(data);
      })
      .catch(() => {})
      .finally(() => {
        if (isFirst.current) {
          setLoading(false);
          isFirst.current = false;
        }
      });
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchApprovals();
    const id = setInterval(fetchApprovals, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token]);

  async function handleReview() {
    if (!reviewTarget) return;
    setSubmitting(true);
    setReviewError("");
    try {
      await apiPost(`/api/approvals/${reviewTarget.id}/${reviewTarget.action}`, {
        reviewNote: reviewNote || undefined,
      }, token);
      setReviewTarget(null);
      setReviewNote("");
      fetchApprovals();
    } catch (e: any) {
      // Surface the real error (most commonly: 403 when the caller lacks the
      // `developer` role, or "self-approval is not allowed" when the same
      // agent that requested the approval is trying to resolve it). The
      // dialog stays open so the user can read the reason.
      const msg = typeof e?.message === "string" ? e.message : "Failed to submit decision.";
      setReviewError(msg.replace(/^[A-Z]+ \/api\/approvals\/[^ ]+ \d+: /, ""));
    } finally {
      setSubmitting(false);
    }
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const history = approvals.filter((a) => a.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={loading ? "Loading..." : `${pending.length} pending approval${pending.length !== 1 ? "s" : ""}`}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading approvals...</div>
      ) : (
        <div className="space-y-8 px-4">
          {/* Pending Approvals */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Pending Approvals ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No pending approvals
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[a.type] ?? typeColors.escalation}`}>
                            {a.type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                        )}
                        {a.requestedByAgentId && (
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                            Requested by: {a.requestedByAgentId}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => { setReviewTarget({ id: a.id, action: "reject" }); setReviewNote(""); setReviewError(""); }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => { setReviewTarget({ id: a.id, action: "approve" }); setReviewNote(""); setReviewError(""); }}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* History */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              History
            </h2>
            {history.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No approval history
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Type</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Title</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Reviewed By</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Note</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className="border-b border-border">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[a.type] ?? typeColors.escalation}`}>
                            {a.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{a.title}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[a.status] ?? statusColors.expired}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.reviewedByUserId ?? "-"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{a.reviewNote ?? "-"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{a.reviewedAt ? timeAgo(a.reviewedAt) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Review Dialog */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setReviewTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-1">
              {reviewTarget.action === "approve" ? "Approve" : "Reject"} Request
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Add an optional note for this decision.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Review Note (optional)</label>
              <Input
                className="mt-1 text-xs"
                placeholder="Reason for this decision..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
            {reviewError && (
              <p className="mt-3 text-xs text-red-400" role="alert">
                {reviewError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setReviewTarget(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleReview}
                disabled={submitting}
                className={reviewTarget.action === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                {submitting ? "Submitting..." : reviewTarget.action === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

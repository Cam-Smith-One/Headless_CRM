"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const POLL_INTERVAL = 10_000;
const PAGE_SIZE = 50;

const typeColors: Record<string, string> = {
  autonomous: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reactive: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  supervised: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  scheduled: "bg-green-500/15 text-green-400 border-green-500/20",
};

const roleColors: Record<string, string> = {
  reader: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  operator: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  developer: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  auditor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchAgent = useCallback(() => {
    return apiFetch<any[]>("/api/agents", { token }).then((res) => {
      const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
      const found = list.find((a: any) => a.id === id);
      if (found) setAgent(found);
      return found;
    }).catch(() => null);
  }, [id, token]);

  const fetchLogs = useCallback((currentOffset: number, append: boolean, replace = true) => {
    setLogsLoading(true);
    return apiFetch<any[]>(`/api/agents/${id}/logs?limit=${PAGE_SIZE}&offset=${currentOffset}`, { token })
      .then((res) => {
        const items = Array.isArray(res) ? res : (res as any)?.data ?? [];
        if (append) {
          setLogs((prev) => [...prev, ...items]);
        } else if (replace) {
          setLogs(items);
        } else {
          // Poll mode: prepend any new items not already in the list
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newItems = items.filter((i: any) => !existingIds.has(i.id));
            return newItems.length > 0 ? [...newItems, ...prev] : prev;
          });
        }
        setHasMore(items.length === PAGE_SIZE);
      })
      .catch(() => {
        if (append || !replace) { /* keep existing logs */ } else setLogs([]);
      })
      .finally(() => setLogsLoading(false));
  }, [id, token]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAgent(), fetchLogs(0, false)]).finally(() => setLoading(false));
  }, [fetchAgent, fetchLogs]);

  // Auto-refresh every 10s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchAgent();
      fetchLogs(0, false, false);
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAgent, fetchLogs]);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchLogs(next, true);
  }

  // Compute stats from logs
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalActions = logs.length;
  const actionsToday = logs.filter((e) => new Date(e.createdAt) >= todayStart).length;
  const actionsThisWeek = logs.filter((e) => new Date(e.createdAt) >= weekStart).length;

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!agent) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Agent not found</div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/agents")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        &larr; Back to Agents
      </button>

      {/* Agent info */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-lg font-mono font-semibold text-muted-foreground shrink-0">
          {agent.name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[agent.type] ?? ""}`}>
              {agent.type}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleColors[agent.role] ?? ""}`}>
              {agent.role}
            </span>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${agent.status === "active" ? "bg-green-500" : agent.status === "pending_approval" ? "bg-yellow-500" : "bg-zinc-500"}`} />
            <span className="text-xs text-muted-foreground">{agent.status}</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">{agent.id}</p>
          {agent.createdAt && (
            <p className="text-xs text-muted-foreground mt-1">Created {new Date(agent.createdAt).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Actions</p>
            <p className="text-2xl font-mono font-semibold tabular-nums mt-1">{totalActions}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-2xl font-mono font-semibold tabular-nums mt-1">{actionsToday}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">This Week</p>
            <p className="text-2xl font-mono font-semibold tabular-nums mt-1">{actionsThisWeek}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Log */}
      <h2 className="text-sm font-medium mb-3">Action Log</h2>
      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No events recorded for this agent</p>
      ) : (
        <>
          <div className="border border-border rounded-lg divide-y divide-border">
            <div className="grid grid-cols-[120px_100px_1fr_180px] gap-2 px-4 py-2 text-[11px] text-muted-foreground font-medium bg-secondary/30">
              <span>Event Type</span>
              <span>Record Type</span>
              <span>Record ID / Changes</span>
              <span className="text-right">Timestamp</span>
            </div>
            {logs.map((ev) => (
              <div key={ev.id} className="grid grid-cols-[120px_100px_1fr_180px] gap-2 px-4 py-2.5 text-[13px] items-center">
                <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5 w-fit">
                  {ev.eventType}
                </Badge>
                <span className="text-xs text-muted-foreground">{ev.recordType || "—"}</span>
                <div className="min-w-0">
                  <span className="text-xs font-mono text-muted-foreground truncate block">{ev.recordId || "—"}</span>
                  {ev.changes && Object.keys(ev.changes).length > 0 && (
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {Object.keys(ev.changes).join(", ")}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-mono tabular-nums text-right">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="secondary" size="sm" onClick={loadMore} disabled={logsLoading}>
                {logsLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api";

const eventColors: Record<string, string> = {
  created: "bg-green-500/15 text-green-400",
  updated: "bg-blue-500/15 text-blue-400",
  stage_changed: "bg-purple-500/15 text-purple-400",
  status_changed: "bg-purple-500/15 text-purple-400",
  deleted: "bg-red-500/15 text-red-400",
};

function getEventAction(type: string) {
  const parts = type.split(".");
  return parts[parts.length - 1];
}

function getEventCollection(type: string) {
  const parts = type.split(".");
  return parts[0] || "unknown";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

const POLL_INTERVAL = 10_000;

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const isFirst = useRef(true);

  function fetchEvents() {
    apiFetch<any>("/api/events")
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.data ?? data ?? [];
        if (items.length) setEvents(items);
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchEvents();
    // Fetch agent names for display
    apiFetch<any>("/api/agents").then((res) => {
      const agents = Array.isArray(res) ? res : res?.data ?? [];
      const map: Record<string, string> = {};
      agents.forEach((a: any) => { if (a.id && a.name) map[a.id] = a.name; });
      setAgentNames(map);
    }).catch(() => {});
    const id = setInterval(fetchEvents, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter((e) =>
      [e.eventType, e.type, e.agentId, e.recordId].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [events, search]);

  return (
    <div>
      <PageHeader
        title="Activity Feed"
        description={loading ? "Loading..." : `${events.length} events — audit trail of all agent actions`}
        searchPlaceholder="Filter events..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading activity...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground">Events appear here when agents create, update, or delete CRM records</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((event) => {
            const action = getEventAction(event.eventType || event.type || "");
            const collection = getEventCollection(event.eventType || event.type || "");
            const colorCls = eventColors[action] ?? eventColors.created;
            const changes = event.changes || {};
            const hasChanges = typeof changes === "object" && Object.keys(changes).length > 0;

            return (
              <div key={event.id} className="flex items-start gap-3 px-6 py-3 hover:bg-secondary/20 transition-colors">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 mt-0.5 ${colorCls}`}>
                  <span className="text-[10px] font-bold">{action.charAt(0).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <span className="font-mono text-xs text-muted-foreground">{event.eventType || event.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] mt-0.5">
                    <span className="text-muted-foreground text-xs">
                      {agentNames[event.agentId] || event.agentId || "system"}
                    </span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="font-medium font-mono text-xs">{event.recordId}</span>
                  </div>

                  {hasChanges && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(changes).map(([field, change]) => {
                        const isObj = typeof change === "object" && change !== null && ("before" in (change as any) || "after" in (change as any));
                        return (
                          <span key={field} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-mono">
                            <span className="text-muted-foreground">{field}:</span>
                            {isObj ? (
                              <>
                                {(change as any).before !== null && (change as any).before !== undefined && (
                                  <>
                                    <span className="text-red-400 line-through">{String((change as any).before)}</span>
                                    <span className="text-muted-foreground">&rarr;</span>
                                  </>
                                )}
                                <span className="text-green-400">{String((change as any).after)}</span>
                              </>
                            ) : (
                              <span className="text-green-400">{String(change)}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                    {event.recordType || collection}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground font-mono tabular-nums mt-1">
                    {formatTime(event.createdAt || event.time)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {formatTimestamp(event.createdAt || event.time)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

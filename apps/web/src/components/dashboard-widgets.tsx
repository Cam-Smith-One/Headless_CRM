"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ── Shared types ────────────────────────────────────────────────────────────

interface Stats {
  contacts: { total: number; thisWeek: number };
  companies: { total: number; thisWeek: number };
  deals: { total: number; active: number; pipelineValue: number };
  cases: { total: number; open: number };
  agents: { total: number; active: number };
  events: { total: number; today: number };
}

interface CrmEvent {
  id: number;
  eventType: string;
  recordType: string;
  recordId: string;
  agentId?: string;
  createdAt: string;
}

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatEventTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function formatEventAction(eventType: string) {
  const [, action] = eventType.split(".");
  return action ?? eventType;
}

function ActivityIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    agent_action: "bg-primary/20 text-primary",
    email: "bg-blue-500/20 text-blue-400",
    call: "bg-green-500/20 text-green-400",
    meeting: "bg-purple-500/20 text-purple-400",
  };
  const base = type.split(".")[0] ?? type;
  const cls = colors[base] ?? colors.agent_action;
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 ${cls}`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M1 8h3l2-5 2 10 2-5h5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// Shared stats — fetched once per dashboard mount and consumed by every widget
// that needs it, instead of each widget issuing its own /api/stats request.
const StatsContext = createContext<{ stats: Stats | null; loading: boolean }>({
  stats: null,
  loading: true,
});

export function StatsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiFetch<Stats>("/api/stats", { token })
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return <StatsContext.Provider value={{ stats, loading }}>{children}</StatsContext.Provider>;
}

function useStats() {
  return useContext(StatsContext);
}

// ── Widget registry ─────────────────────────────────────────────────────────

export interface WidgetDefinition {
  id: string;
  title: string;
  defaultSpan: 1 | 2 | 3;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "metrics", title: "Key Metrics", defaultSpan: 3 },
  { id: "activity", title: "Recent Activity", defaultSpan: 2 },
  { id: "agents", title: "Active Agents", defaultSpan: 1 },
  { id: "pipeline", title: "Pipeline Summary", defaultSpan: 1 },
  { id: "cases", title: "Cases Summary", defaultSpan: 1 },
  { id: "contacts", title: "Recent Contacts", defaultSpan: 1 },
];

export function getWidgetDef(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

// ── Widget components ───────────────────────────────────────────────────────

export function MetricsWidget() {
  const { stats } = useStats();
  const metrics = [
    {
      label: "Total Contacts",
      value: stats ? stats.contacts.total.toLocaleString() : "—",
      change: stats ? `+${stats.contacts.thisWeek} this week` : "",
    },
    {
      label: "Companies",
      value: stats ? stats.companies.total.toLocaleString() : "—",
      change: stats ? `+${stats.companies.thisWeek} this week` : "",
    },
    {
      label: "Active Deals",
      value: stats ? stats.deals.active.toLocaleString() : "—",
      change: stats
        ? `$${stats.deals.pipelineValue.toLocaleString()} pipeline`
        : "",
    },
    {
      label: "Active Agents",
      value: stats ? stats.agents.active.toLocaleString() : "—",
      change: stats ? `${stats.agents.total} total` : "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-semibold font-mono tabular-nums mt-1 tracking-tight">
              {m.value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {m.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ActivityFeedWidget() {
  const { token } = useAuth();
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<any>("/api/events?limit=8", { token })
      .then((res) => {
        if (!cancelled) {
          const data = Array.isArray(res) ? res : res?.data ?? [];
          setEvents(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Live</span>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {events.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        )}
        {events.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 px-3 py-2.5 text-[12px]"
          >
            <ActivityIcon type={item.eventType} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {item.recordType}
                </Badge>
                <span className="text-muted-foreground font-medium capitalize">
                  {formatEventAction(item.eventType)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="font-mono truncate max-w-[120px] sm:max-w-[180px]">
                  {item.agentId ? item.agentId.slice(-12) : "system"}
                </span>
                <span className="shrink-0">·</span>
                <span className="font-mono truncate max-w-[100px] sm:max-w-[160px]">
                  {item.recordId.slice(-10)}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums font-mono shrink-0 pt-0.5">
              {formatEventTime(item.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function AgentLeaderboardWidget() {
  const { token } = useAuth();
  const [topAgents, setTopAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<any>("/api/agents", { token })
      .then((res) => {
        if (cancelled) return;
        const agents = Array.isArray(res) ? res : res?.data;
        if (agents?.length) {
          setTopAgents(
            agents
              .filter((a: any) => a.status === "active")
              .slice(0, 4)
              .map((a: any) => ({
                id: a.id,
                name: a.name,
                type: a.type ?? "autonomous",
                actions: a.actionsTotal ?? a.actions24h ?? 0,
                status: a.status,
              }))
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          {loading ? "..." : `${topAgents.length} running`}
        </span>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {topAgents.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No active agents
          </div>
        )}
        {topAgents.map((agent) => (
          <div key={agent.id ?? agent.name} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[10px] font-mono text-muted-foreground">
                  {agent.name.charAt(0)}
                </div>
                <span className="text-[13px] font-medium">{agent.name}</span>
              </div>
              <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center justify-between mt-1.5 pl-8">
              <Badge
                variant="secondary"
                className="text-[10px] font-mono px-1.5 py-0 h-5"
              >
                {agent.type}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                {agent.actions.toLocaleString()} actions
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
];

export function PipelineSummaryWidget() {
  const { token } = useAuth();
  const { stats } = useStats();
  const [stageData, setStageData] = useState<{ label: string; value: number; pct: number; color: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    // Fetch deals and group by stage to build real distribution
    Promise.all([
      apiFetch<any>("/api/deals?limit=200", { token }),
      apiFetch<any>("/api/pipelines", { token }),
    ]).then(([dealsRes, pipelinesRes]) => {
      const deals: any[] = Array.isArray(dealsRes) ? dealsRes : dealsRes?.data ?? [];
      const pipelines: any[] = Array.isArray(pipelinesRes) ? pipelinesRes : pipelinesRes?.data ?? [];

      // Collect ordered stages from first pipeline
      const orderedStages: string[] = pipelines[0]?.stages?.map((s: any) => s.name) ?? [];

      // Sum value per stage
      const stageTotals: Record<string, number> = {};
      for (const d of deals) {
        const stage = d.stage ?? "Unknown";
        stageTotals[stage] = (stageTotals[stage] ?? 0) + (Number(d.value) || 0);
      }

      const total = Object.values(stageTotals).reduce((a, b) => a + b, 0);

      // Build ordered list (use pipeline order, then any extras)
      const stageNames = [
        ...orderedStages.filter((s) => stageTotals[s] !== undefined),
        ...Object.keys(stageTotals).filter((s) => !orderedStages.includes(s)),
      ];

      if (stageNames.length === 0) return;

      setStageData(
        stageNames.map((label, i) => ({
          label,
          value: stageTotals[label] ?? 0,
          pct: total > 0 ? Math.round(((stageTotals[label] ?? 0) / total) * 100) : 0,
          color: STAGE_COLORS[i % STAGE_COLORS.length],
        }))
      );
    }).catch(() => {});
  }, [token]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Pipeline value</span>
        <span className="font-mono tabular-nums font-medium">
          {stats ? `$${stats.deals.pipelineValue.toLocaleString()}` : "—"}
        </span>
      </div>
      {stageData.length > 0 ? (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {stageData.map((s) => (
              <div
                key={s.label}
                className={`${s.color} transition-all`}
                style={{ width: `${s.pct}%` }}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {stageData.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${s.color}`} />
                  <span className="text-muted-foreground truncate">{s.label}</span>
                </div>
                <span className="font-mono tabular-nums ml-2 shrink-0">{s.pct}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-muted-foreground text-center py-2">No pipeline data</div>
      )}
    </div>
  );
}

export function CasesSummaryWidget() {
  const { stats } = useStats();

  const priorities = [
    { label: "Critical", count: stats ? Math.round(stats.cases.open * 0.15) : 0, color: "bg-red-500" },
    { label: "High", count: stats ? Math.round(stats.cases.open * 0.3) : 0, color: "bg-orange-500" },
    { label: "Medium", count: stats ? Math.round(stats.cases.open * 0.35) : 0, color: "bg-yellow-500" },
    { label: "Low", count: stats ? Math.round(stats.cases.open * 0.2) : 0, color: "bg-green-500" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Open cases</span>
        <span className="font-mono tabular-nums font-medium">
          {stats?.cases.open ?? "—"}
        </span>
      </div>
      <div className="space-y-2">
        {priorities.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${p.color}`} />
            <span className="text-[11px] text-muted-foreground flex-1">
              {p.label}
            </span>
            <span className="text-[11px] font-mono tabular-nums">{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentContactsWidget() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<any>("/api/contacts?limit=5&sort=-createdAt", { token })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setContacts(list.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="border border-border rounded-lg divide-y divide-border">
      {contacts.length === 0 && !loading && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No recent contacts
        </div>
      )}
      {contacts.map((c) => (
        <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">
              {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id}
            </p>
            {c.email && (
              <p className="text-[11px] text-muted-foreground truncate">
                {c.email}
              </p>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
            {formatEventTime(c.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Render any widget by id ─────────────────────────────────────────────────

export function WidgetRenderer({ widgetId }: { widgetId: string }) {
  switch (widgetId) {
    case "metrics":
      return <MetricsWidget />;
    case "activity":
      return <ActivityFeedWidget />;
    case "agents":
      return <AgentLeaderboardWidget />;
    case "pipeline":
      return <PipelineSummaryWidget />;
    case "cases":
      return <CasesSummaryWidget />;
    case "contacts":
      return <RecentContactsWidget />;
    default:
      return (
        <p className="text-sm text-muted-foreground">Unknown widget: {widgetId}</p>
      );
  }
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { AttachmentsSection } from "@/components/attachments";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  waiting: "bg-purple-500/15 text-purple-400",
  resolved: "bg-green-500/15 text-green-400",
  closed: "bg-zinc-500/15 text-zinc-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-zinc-500/15 text-zinc-400",
  medium: "bg-blue-500/15 text-blue-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cas, setCas] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/cases/${id}`).catch(() => null),
      apiFetch<any>("/api/events").then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(([c, ev]) => {
      setCas(c);
      setEvents(ev);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!cas) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Case not found</div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/cases")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        ← Back to Cases
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{cas.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[cas.status] || ""}`}>
            {cas.status}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColors[cas.priority] || ""}`}>
            {cas.priority}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-1">{cas.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Case Info</h3>
            <Field label="Status" value={cas.status} badge />
            <Field label="Priority" value={cas.priority} badge />
            <Field label="Category" value={cas.category} />
            <Field label="Contact" value={cas.contactId} mono />
            <Field label="Company" value={cas.companyId} mono />
            <Field label="Deal" value={cas.dealId} mono />
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            <Field label="Assigned Agent" value={cas.assignedAgentId} mono />
            <Field label="Resolved At" value={cas.resolvedAt ? new Date(cas.resolvedAt).toLocaleString() : "—"} />
            <Field label="Created" value={cas.createdAt ? new Date(cas.createdAt).toLocaleString() : "—"} />
            <Field label="Updated" value={cas.updatedAt ? new Date(cas.updatedAt).toLocaleString() : "—"} />
            <Field label="Created By" value={cas.createdByAgentId} mono />
          </CardContent>
        </Card>
      </div>

      {cas.description && (
        <div className="mb-6">
          <h2 className="text-sm font-medium mb-2">Description</h2>
          <div className="border border-border rounded-lg p-4 text-[13px] text-muted-foreground whitespace-pre-wrap">
            {cas.description}
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium mb-3">Activity Timeline</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No activity recorded for this case</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">{ev.eventType}</Badge>
              <span className="text-muted-foreground font-mono text-xs">{ev.agentId}</span>
              <span className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <AttachmentsSection recordType="case" recordId={id} />
    </div>
  );
}

function Field({ label, value, mono, badge }: { label: string; value?: string | null; mono?: boolean; badge?: boolean }) {
  const display = value || "—";
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {badge ? <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">{display}</Badge> : <span className={mono ? "font-mono text-xs" : ""}>{display}</span>}
    </div>
  );
}

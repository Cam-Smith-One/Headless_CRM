"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { AttachmentsSection } from "@/components/attachments";

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/deals/${id}`).catch(() => null),
      apiFetch<any>("/api/events").then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(([d, ev]) => {
      setDeal(d);
      setEvents(ev);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!deal) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Deal not found</div>;

  const value = deal.value ? `$${Number(deal.value).toLocaleString()}` : "—";

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/deals")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        ← Back to Deals
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{deal.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs font-mono">{deal.stage || "Unknown Stage"}</Badge>
          <span className="text-lg font-semibold font-mono text-green-400">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-1">{deal.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Deal Info</h3>
            <Field label="Stage" value={deal.stage} badge />
            <Field label="Value" value={value} />
            <Field label="Currency" value={deal.currency || "USD"} />
            <Field label="Pipeline" value={deal.pipelineId} mono />
            <Field label="Company" value={deal.companyId} mono />
            <Field label="Status" value={deal.stateCode || "active"} badge />
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            <Field label="Expected Close" value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—"} />
            <Field label="Created" value={deal.createdAt ? new Date(deal.createdAt).toLocaleString() : "—"} />
            <Field label="Updated" value={deal.updatedAt ? new Date(deal.updatedAt).toLocaleString() : "—"} />
            <Field label="Created By" value={deal.createdByAgentId} mono />
            <Field label="Updated By" value={deal.updatedByAgentId} mono />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-medium mb-3">Activity Timeline</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No activity recorded for this deal</p>
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

      <AttachmentsSection recordType="deal" recordId={id} />
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

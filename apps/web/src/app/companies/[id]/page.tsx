"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { AttachmentsSection } from "@/components/attachments";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/companies/${id}`).catch(() => null),
      apiFetch<any>("/api/events").then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(([c, ev]) => {
      setCompany(c);
      setEvents(ev);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!company) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Company not found</div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/companies")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        ← Back to Companies
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{company.name}</h1>
        <p className="text-sm text-muted-foreground">{company.domain || "No domain"}</p>
        <p className="text-xs text-muted-foreground font-mono mt-1">{company.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
            <Field label="Domain" value={company.domain} mono />
            <Field label="Industry" value={company.industry} />
            <Field label="Size" value={company.size} />
            <Field label="Status" value={company.stateCode || "active"} badge />
            <Field label="Parent Company" value={company.parentCompanyId} mono />
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            <Field label="Created" value={company.createdAt ? new Date(company.createdAt).toLocaleString() : "—"} />
            <Field label="Updated" value={company.updatedAt ? new Date(company.updatedAt).toLocaleString() : "—"} />
            <Field label="Created By" value={company.createdByAgentId} mono />
            <Field label="Updated By" value={company.updatedByAgentId} mono />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-medium mb-3">Activity Timeline</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No activity recorded for this company</p>
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

      <AttachmentsSection recordType="company" recordId={id} />
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

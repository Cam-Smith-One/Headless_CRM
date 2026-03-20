"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AttachmentsSection } from "@/components/attachments";

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [deal, setDeal] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/deals/${id}`, { token }).catch(() => null),
      apiFetch<any>("/api/events", { token }).then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(async ([d, ev]) => {
      setDeal(d);
      setEvents(ev);
      if (d?.companyId) {
        try {
          const co = await apiFetch<any>(`/api/companies/${d.companyId}`, { token });
          setCompanyName(co?.name ?? null);
        } catch { setCompanyName(null); }
      }
      if (d?.pipelineId) {
        try {
          const p = await apiFetch<any>(`/api/pipelines/${d.pipelineId}`, { token });
          setPipelineName(p?.name ?? null);
        } catch { setPipelineName(null); }
      }
    }).finally(() => setLoading(false));
  }, [id, token]);

  function startEditing() {
    setEditForm({
      name: deal.name || "",
      stage: deal.stage || "",
      value: deal.value?.toString() || "",
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (payload.value) payload.value = Number(payload.value);
      const updated = await apiPatch(`/api/deals/${id}`, payload, token);
      setDeal(updated);
      setEditing(false);
    } catch { /* handle error */ } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this deal?")) return;
    try {
      await apiDelete(`/api/deals/${id}`, token);
      router.push("/deals");
    } catch { /* handle error */ }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!deal) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Deal not found</div>;

  const value = deal.value ? `$${Number(deal.value).toLocaleString()}` : "\u2014";

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/deals")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        &larr; Back to Deals
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{deal.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs font-mono">{deal.stage || "Unknown Stage"}</Badge>
            <span className="text-lg font-semibold font-mono text-green-400">{value}</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">{deal.id}</p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button size="sm" variant="outline" onClick={startEditing}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Edit Deal</h3>
            {(["name", "stage", "value"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground capitalize">{field}</label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  type={field === "value" ? "number" : "text"}
                  value={editForm[field] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Deal Info</h3>
              <Field label="Stage" value={deal.stage} badge />
              <Field label="Value" value={value} />
              <Field label="Currency" value={deal.currency || "USD"} />
              <Field label="Pipeline" value={pipelineName || (deal.pipelineId ? deal.pipelineId.slice(0, 12) + "..." : null)} />
              <Field label="Company" value={companyName || (deal.companyId ? deal.companyId.slice(0, 12) + "..." : null)} />
              <Field label="Status" value={deal.stateCode || "active"} badge />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
              <Field label="Expected Close" value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "\u2014"} />
              <Field label="Created" value={deal.createdAt ? new Date(deal.createdAt).toLocaleString() : "\u2014"} />
              <Field label="Updated" value={deal.updatedAt ? new Date(deal.updatedAt).toLocaleString() : "\u2014"} />
              <Field label="Created By" value={deal.createdByAgentId} mono />
              <Field label="Updated By" value={deal.updatedByAgentId} mono />
            </CardContent>
          </Card>
        </div>
      )}

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
  const display = value || "\u2014";
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {badge ? <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">{display}</Badge> : <span className={mono ? "font-mono text-xs" : ""}>{display}</span>}
    </div>
  );
}

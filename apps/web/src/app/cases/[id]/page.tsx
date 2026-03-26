"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AttachmentsSection } from "@/components/attachments";
import { CustomFieldsDisplay, CustomFieldsFormFields } from "@/components/custom-fields";

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
  const { token } = useAuth();
  const [cas, setCas] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [contactName, setContactName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [dealName, setDealName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/cases/${id}`, { token }).catch(() => null),
      apiFetch<any>("/api/events", { token }).then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(async ([c, ev]) => {
      setCas(c);
      setEvents(ev);
      // Resolve contact name
      if (c?.contactId) {
        try {
          const contact = await apiFetch<any>(`/api/contacts/${c.contactId}`, { token });
          setContactName([contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || contact?.email || null);
        } catch { setContactName(null); }
      }
      // Resolve company name
      if (c?.companyId) {
        try {
          const company = await apiFetch<any>(`/api/companies/${c.companyId}`, { token });
          setCompanyName(company?.name ?? null);
        } catch { setCompanyName(null); }
      }
      // Resolve deal name
      if (c?.dealId) {
        try {
          const deal = await apiFetch<any>(`/api/deals/${c.dealId}`, { token });
          setDealName(deal?.title ?? deal?.name ?? null);
        } catch { setDealName(null); }
      }
    }).finally(() => setLoading(false));
  }, [id, token]);

  function startEditing() {
    setEditForm({
      title: cas.title || "",
      status: cas.status || "open",
      priority: cas.priority || "medium",
      category: cas.category || "",
      description: cas.description || "",
    });
    setCustomFieldValues(cas.customFields ?? {});
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (Object.keys(customFieldValues).length > 0) {
        payload.customFields = customFieldValues;
      }
      const updated = await apiPatch(`/api/cases/${id}`, payload, token);
      setCas(updated);
      setEditing(false);
    } catch { /* handle error */ } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this case?")) return;
    try {
      await apiDelete(`/api/cases/${id}`, token);
      router.push("/cases");
    } catch { /* handle error */ }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!cas) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Case not found</div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/cases")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        &larr; Back to Cases
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
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
            <h3 className="text-xs font-medium text-muted-foreground">Edit Case</h3>
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {["open", "in_progress", "waiting", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm min-h-[80px]" value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <CustomFieldsFormFields collection="cases" values={customFieldValues} onChange={setCustomFieldValues} />
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
              <h3 className="text-xs font-medium text-muted-foreground">Case Info</h3>
              <Field label="Status" value={cas.status} badge />
              <Field label="Priority" value={cas.priority} badge />
              <Field label="Category" value={cas.category} />
              <Field label="Contact" value={contactName || cas.contactId} mono={!contactName} />
              <Field label="Company" value={companyName || cas.companyId} mono={!companyName} />
              <Field label="Deal" value={dealName || cas.dealId} mono={!dealName} />
              <CustomFieldsDisplay collection="cases" customFields={cas.customFields} />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
              <Field label="Assigned Agent" value={cas.assignedAgentId} mono />
              <Field label="Resolved At" value={cas.resolvedAt ? new Date(cas.resolvedAt).toLocaleString() : "\u2014"} />
              <Field label="Created" value={cas.createdAt ? new Date(cas.createdAt).toLocaleString() : "\u2014"} />
              <Field label="Updated" value={cas.updatedAt ? new Date(cas.updatedAt).toLocaleString() : "\u2014"} />
              <Field label="Created By" value={cas.createdByAgentId} mono />
            </CardContent>
          </Card>
        </div>
      )}

      {cas.description && !editing && (
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
  const display = value || "\u2014";
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {badge ? <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">{display}</Badge> : <span className={mono ? "font-mono text-xs" : ""}>{display}</span>}
    </div>
  );
}

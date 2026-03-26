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
import { CompanyContacts, CompanyDeals, CompanyCases } from "@/components/related-records";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/companies/${id}`, { token }).catch(() => null),
      apiFetch<any>("/api/events", { token }).then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(([c, ev]) => {
      setCompany(c);
      setEvents(ev);
    }).finally(() => setLoading(false));
  }, [id, token]);

  function startEditing() {
    setEditForm({
      name: company.name || "",
      domain: company.domain || "",
      industry: company.industry || "",
      size: company.size || "",
    });
    setCustomFieldValues(company.customFields ?? {});
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (Object.keys(customFieldValues).length > 0) {
        payload.customFields = customFieldValues;
      }
      const updated = await apiPatch(`/api/companies/${id}`, payload, token);
      setCompany(updated);
      setEditing(false);
    } catch { /* handle error */ } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this company?")) return;
    try {
      await apiDelete(`/api/companies/${id}`, token);
      router.push("/companies");
    } catch { /* handle error */ }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!company) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Company not found</div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <button onClick={() => router.push("/companies")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        &larr; Back to Companies
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.domain || "No domain"}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{company.id}</p>
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
            <h3 className="text-xs font-medium text-muted-foreground">Edit Company</h3>
            {(["name", "domain", "industry", "size"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground capitalize">{field}</label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={editForm[field] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                />
              </div>
            ))}
            <CustomFieldsFormFields collection="companies" values={customFieldValues} onChange={setCustomFieldValues} />
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
              <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
              <Field label="Domain" value={company.domain} mono />
              <Field label="Industry" value={company.industry} />
              <Field label="Size" value={company.size} />
              <Field label="Status" value={company.stateCode || "active"} badge />
              <CustomFieldsDisplay collection="companies" customFields={company.customFields} />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
              <Field label="Created" value={company.createdAt ? new Date(company.createdAt).toLocaleString() : "\u2014"} />
              <Field label="Updated" value={company.updatedAt ? new Date(company.updatedAt).toLocaleString() : "\u2014"} />
              <Field label="Created By" value={company.createdByAgentId} mono />
              <Field label="Updated By" value={company.updatedByAgentId} mono />
            </CardContent>
          </Card>
        </div>
      )}

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

      <div className="mt-8 space-y-6">
        <CompanyContacts companyId={id} />
        <CompanyDeals companyId={id} />
        <CompanyCases companyId={id} />
      </div>

      <AttachmentsSection recordType="company" recordId={id} />
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

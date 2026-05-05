"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AttachmentsSection } from "@/components/attachments";
import { CustomFieldsDisplay, CustomFieldsFormFields, normalizeCustomFields } from "@/components/custom-fields";
import { ContactDeals, ContactCases } from "@/components/related-records";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [contact, setContact] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmails = useCallback(() => {
    apiFetch<any>(`/api/activities?contactId=${id}&type=email`, { token })
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setEmails(items);
      })
      .catch(() => setEmails([]));
  }, [id, token]);

  useEffect(() => {
    Promise.all([
      apiFetch<any>(`/api/contacts/${id}`, { token }).catch(() => null),
      apiFetch<any>("/api/events", { token }).then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        return items.filter((e: any) => e.recordId === id);
      }).catch(() => []),
    ]).then(async ([c, ev]) => {
      setContact(c);
      setEvents(ev);
      if (c?.email) {
        setComposeForm((prev) => ({ ...prev, to: c.email }));
      }
      // Resolve company name
      if (c?.companyId) {
        try {
          const co = await apiFetch<any>(`/api/companies/${c.companyId}`, { token });
          setCompanyName(co?.name ?? null);
        } catch {
          setCompanyName(null);
        }
      }
    }).finally(() => setLoading(false));
    loadEmails();
  }, [id, loadEmails, token]);

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await apiPost("/api/emails/send", {
        to: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body,
        contactId: id,
      }, token);
      setShowCompose(false);
      setComposeForm((prev) => ({ ...prev, subject: "", body: "" }));
      loadEmails();
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  }

  function startEditing() {
    setEditForm({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      title: contact.title || "",
    });
    setCustomFieldValues(normalizeCustomFields(contact.customFields));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      if (Object.keys(customFieldValues).length > 0) {
        payload.customFields = customFieldValues;
      }
      const updated = await apiPatch(`/api/contacts/${id}`, payload, token);
      setContact(updated);
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this contact? This action cannot be undone.")) return;
    try {
      await apiDelete(`/api/contacts/${id}`, token);
      router.push("/contacts");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete contact");
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>;
  if (!contact) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Contact not found</div>;

  return (
    <div className="p-4 sm:p-6 max-w-[1000px]">
      <button onClick={() => router.push("/contacts")} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        &larr; Back to Contacts
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg font-medium text-muted-foreground shrink-0">
            {contact.firstName?.[0]}{contact.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{contact.firstName} {contact.lastName}</h1>
            <p className="text-sm text-muted-foreground">{contact.title || "No title"}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{contact.id}</p>
          </div>
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
            <h3 className="text-xs font-medium text-muted-foreground">Edit Contact</h3>
            {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            {(["firstName", "lastName", "email", "phone", "title"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={editForm[field] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                />
              </div>
            ))}
            <CustomFieldsFormFields collection="contacts" values={customFieldValues} onChange={setCustomFieldValues} />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
              <Field label="Email" value={contact.email} mono />
              <Field label="Phone" value={contact.phone} />
              <Field label="Title" value={contact.title} />
              <Field label="Status" value={contact.stateCode || "active"} badge />
              <Field label="Company" value={companyName || (contact.companyId ? contact.companyId.slice(0, 12) + "..." : null)} />
              <CustomFieldsDisplay collection="contacts" customFields={contact.customFields} />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
              <Field label="Created" value={contact.createdAt ? new Date(contact.createdAt).toLocaleString() : "\u2014"} />
              <Field label="Updated" value={contact.updatedAt ? new Date(contact.updatedAt).toLocaleString() : "\u2014"} />
              <Field label="Created By" value={contact.createdByAgentId} mono />
              <Field label="Updated By" value={contact.updatedByAgentId} mono />
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="text-sm font-medium mb-3">Activity Timeline</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No activity recorded for this contact</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                {ev.eventType}
              </Badge>
              <span className="text-muted-foreground font-mono text-xs">{ev.agentId}</span>
              <span className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Emails Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Emails</h2>
          <Button size="sm" variant="outline" onClick={() => setShowCompose(!showCompose)}>
            {showCompose ? "Cancel" : "Compose Email"}
          </Button>
        </div>

        {showCompose && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <form onSubmit={handleSendEmail} className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">To</label>
                  <input
                    type="email"
                    value={composeForm.to}
                    onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Subject</label>
                  <input
                    type="text"
                    value={composeForm.subject}
                    onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Body</label>
                  <textarea
                    value={composeForm.body}
                    onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm min-h-[120px]"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={sending}>
                    {sending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {emails.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No emails for this contact</p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {emails.map((email) => (
              <div key={email.id} className="px-4 py-3 text-[13px]">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={email.direction === "inbound" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-5">
                    {email.direction || "outbound"}
                  </Badge>
                  <span className="font-medium truncate">{email.subject || "(no subject)"}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
                    {email.occurredAt ? new Date(email.occurredAt).toLocaleString() : "\u2014"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {email.metadata?.from && <span>From: {email.metadata.from}</span>}
                  {email.metadata?.to && <span className="ml-3">To: {Array.isArray(email.metadata.to) ? email.metadata.to.join(", ") : email.metadata.to}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-6">
        <ContactDeals contactId={id} />
        <ContactCases contactId={id} />
      </div>

      <AttachmentsSection recordType="contact" recordId={id} />
    </div>
  );
}

function Field({ label, value, mono, badge }: { label: string; value?: string | null; mono?: boolean; badge?: boolean }) {
  const display = value || "\u2014";
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">{display}</Badge>
      ) : (
        <span className={mono ? "font-mono text-xs" : ""}>{display}</span>
      )}
    </div>
  );
}

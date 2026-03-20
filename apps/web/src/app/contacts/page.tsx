"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const POLL_INTERVAL = 10_000;

const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/20",
  qualified: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  nurture: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export default function ContactsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", title: "", companyId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isFirst = useRef(true);

  function fetchContacts() {
    apiFetch<any>("/api/contacts", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (data) setContacts(data);
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchContacts();
    const id = setInterval(fetchContacts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      [c.firstName, c.lastName, c.email, c.title, c.company, c.id]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [contacts, search]);

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/contacts", formData, token);
      setShowModal(false);
      setFormData({ firstName: "", lastName: "", email: "", title: "", companyId: "" });
      fetchContacts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={loading ? "Loading..." : `${contacts.length} records`}
        action="+ New Contact"
        onAction={() => setShowModal(true)}
        searchPlaceholder="Search contacts..."
        searchValue={search}
        onSearchChange={setSearch}
        onExport={async () => {
          const blob = await apiFetchBlob("/api/contacts/export?format=csv", { token });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "contacts-export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {search ? "No contacts match your search" : "No contacts found"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Name</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Email</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Company</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Title</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Created</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Agent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground shrink-0">
                        {c.firstName?.[0]}{c.lastName?.[0]}
                      </div>
                      <div>
                        <span className="font-medium">{c.firstName} {c.lastName}</span>
                        <p className="text-[11px] text-muted-foreground font-mono">{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.email}</td>
                  <td className="px-4 py-2.5">{c.companyId || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.title || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[c.stateCode] ?? statusColors.active}`}>
                      {c.stateCode || "active"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs tabular-nums">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                      {c.createdByAgentId ? c.createdByAgentId.slice(0, 12) + "…" : "—"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-4">New Contact</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">First Name</label>
                <Input className="mt-1 text-xs" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Last Name</label>
                <Input className="mt-1 text-xs" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input className="mt-1 text-xs" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input className="mt-1 text-xs" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Company</label>
                <Input className="mt-1 text-xs" value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !formData.firstName}>
                {submitting ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

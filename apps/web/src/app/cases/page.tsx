"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CustomFieldsFormFields } from "@/components/custom-fields";


const statusColors: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  in_progress: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  waiting: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  resolved: "bg-green-500/15 text-green-400 border-green-500/20",
  closed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  low: "bg-zinc-500/10 text-zinc-500 border-zinc-500/15",
};

const POLL_INTERVAL = 10_000;

export default function CasesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const isFirst = useRef(true);
  const [formData, setFormData] = useState({ title: "", description: "", status: "open", priority: "medium", category: "general", contactId: "", companyId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createCustomFields, setCreateCustomFields] = useState<Record<string, unknown>>({});

  const contactMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of contacts) map[c.id] = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id;
    return map;
  }, [contacts]);

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of companies) map[c.id] = c.name;
    return map;
  }, [companies]);

  function fetchCases() {
    apiFetch<any>("/api/cases", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (data) setCases(data);
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }

  function fetchContacts() {
    apiFetch<any>("/api/contacts", { token })
      .then((res) => { const data = Array.isArray(res) ? res : res?.data; if (data) setContacts(data); })
      .catch(() => {});
  }

  function fetchCompanies() {
    apiFetch<any>("/api/companies", { token })
      .then((res) => { const data = Array.isArray(res) ? res : res?.data; if (data) setCompanies(data); })
      .catch(() => {});
  }

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        title: formData.title,
        status: formData.status,
        priority: formData.priority,
        contactId: formData.contactId,
      };
      if (formData.description) payload.description = formData.description;
      if (formData.category) payload.category = formData.category;
      if (formData.companyId) payload.companyId = formData.companyId;
      if (Object.keys(createCustomFields).length > 0) payload.customFields = createCustomFields;
      await apiPost("/api/cases", payload, token);
      setShowModal(false);
      setFormData({ title: "", description: "", status: "open", priority: "medium", category: "general", contactId: "", companyId: "" });
      setCreateCustomFields({});
      fetchCases();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchCases();
    fetchContacts();
    fetchCompanies();
    const id = setInterval(fetchCases, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter((c) =>
      [c.title, c.status, c.priority, c.category].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [cases, search]);

  return (
    <div>
      <PageHeader
        title="Cases"
        description={loading ? "Loading..." : "Track support interactions and issue resolution"}
        action="+ New Case"
        onAction={() => setShowModal(true)}
        searchPlaceholder="Search cases..."
        searchValue={search}
        onSearchChange={setSearch}
        onExport={async () => {
          const blob = await apiFetchBlob("/api/cases/export?format=csv", { token });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "cases-export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading cases...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {search ? "No cases match your search" : "No cases found"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">ID</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Title</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Priority</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Category</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Contact</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Company</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Assigned Agent</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/cases/${c.id}`)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {c.id}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{c.title}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[c.status] ?? statusColors.open}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityColors[c.priority] ?? priorityColors.medium}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.category}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.contactId ? (contactMap[c.contactId] || c.contactId.slice(0, 12) + "…") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.companyId ? (companyMap[c.companyId] || c.companyId.slice(0, 12) + "…") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {c.assignedAgentId ? c.assignedAgentId.slice(0, 12) + "…" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs tabular-nums">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
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
            <h2 className="text-sm font-semibold mb-4">New Case</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input className="mt-1 text-xs" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <Input className="mt-1 text-xs" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the issue..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contact <span className="text-red-400">*</span></label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.contactId} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}>
                  <option value="">Select a contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{contactMap[c.id] || c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Company (optional)</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}>
                  <option value="">None</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="waiting">waiting</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Input className="mt-1 text-xs" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="general, technical, billing..." />
              </div>
              <CustomFieldsFormFields collection="cases" values={createCustomFields} onChange={setCreateCustomFields} />
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !formData.title || !formData.contactId}>
                {submitting ? "Creating..." : "Create Case"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

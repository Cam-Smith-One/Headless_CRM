"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";


function healthColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

const POLL_INTERVAL = 10_000;

export default function CompaniesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const isFirst = useRef(true);
  const [formData, setFormData] = useState({ name: "", domain: "", industry: "", size: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function fetchCompanies() {
    apiFetch<any>("/api/companies", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (data) setCompanies(data);
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/companies", formData, token);
      setShowModal(false);
      setFormData({ name: "", domain: "", industry: "", size: "" });
      fetchCompanies();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchCompanies();
    const id = setInterval(fetchCompanies, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token]);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) =>
      [c.name, c.domain, c.industry].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [companies, search]);

  return (
    <div>
      <PageHeader
        title="Companies"
        description={loading ? "Loading..." : `${companies.length} records`}
        action="+ New Company"
        onAction={() => setShowModal(true)}
        searchPlaceholder="Search companies..."
        searchValue={search}
        onSearchChange={setSearch}
        onExport={async () => {
          const blob = await apiFetchBlob("/api/companies/export?format=csv", { token });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "companies-export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading companies...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {search ? "No companies match your search" : "No companies found"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Company</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Domain</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Industry</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Size</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Managed By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => router.push(`/companies/${c.id}`)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground shrink-0">
                        {c.name?.charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <p className="text-[11px] text-muted-foreground font-mono">{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.domain}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.industry}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.size}</td>
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
            <h2 className="text-sm font-semibold mb-4">New Company</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input className="mt-1 text-xs" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Domain</label>
                <Input className="mt-1 text-xs" value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} placeholder="example.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Industry</label>
                <Input className="mt-1 text-xs" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Size</label>
                <Input className="mt-1 text-xs" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} placeholder="1-10, 11-50, 51-200..." />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !formData.name}>
                {submitting ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

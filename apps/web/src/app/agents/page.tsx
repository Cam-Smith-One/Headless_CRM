"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, adminPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";


const typeColors: Record<string, string> = {
  autonomous: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reactive: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  supervised: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  scheduled: "bg-green-500/15 text-green-400 border-green-500/20",
};

const roleColors: Record<string, string> = {
  reader: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  operator: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  developer: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  auditor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const POLL_INTERVAL = 10_000;

export default function AgentsPage() {
  const router = useRouter();
  const { token, adminKey } = useAuth();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const isFirst = useRef(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "autonomous", role: "operator", tenantId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successKey, setSuccessKey] = useState("");
  const [copiedField, setCopiedField] = useState("");

  function getApiUrl() {
    return typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  }

  function getMcpConfig(apiKey: string) {
    const apiUrl = getApiUrl();
    return JSON.stringify(
      {
        mcpServers: {
          "headless-crm": {
            url: `${apiUrl}/mcp`,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      },
      null,
      2
    );
  }

  function fetchAgents() {
    apiFetch<any>("/api/agents", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (data) setAgents(data);
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }

  async function handleApproval(id: string, action: "approve" | "reject") {
    try {
      const updated = await apiPost<any>(`/api/agents/${id}/${action}`, {}, token);
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: updated.status ?? (action === "approve" ? "active" : "suspended") } : a)));
    } catch (e) {
      console.error(`Failed to ${action} agent`, e);
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleSuspend(id: string) {
    try {
      setError("");
      const updated = await apiPost<any>(`/api/agents/${id}/suspend`, {}, token);
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: updated.status ?? "suspended" } : a)));
    } catch (e: any) {
      setError(e?.message ?? "Failed to suspend agent");
    }
  }

  async function handleReactivate(id: string) {
    try {
      setError("");
      const updated = await apiPost<any>(`/api/agents/${id}/approve`, {}, token);
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: updated.status ?? "active" } : a)));
    } catch (e: any) {
      setError(e?.message ?? "Failed to reactivate agent");
    }
  }

  async function handleRotateKey(id: string) {
    if (!confirm("Rotate this agent API key? The old key will stop working immediately.")) return;
    try {
      setError("");
      const result = await apiPost<any>(`/api/agents/${id}/rotate-key`, {}, token);
      setSuccessKey(result.apiKey);
      fetchAgents();
    } catch (e: any) {
      setError(e?.message ?? "Failed to rotate API key");
    }
  }

  async function handleProvision() {
    setSubmitting(true);
    setError("");
    try {
      const result = await adminPost<any>("/api/agents/provision", formData, adminKey);
      setSuccessKey(result.apiKey ?? result.token ?? JSON.stringify(result));
      setShowModal(false);
      setFormData({ name: "", type: "autonomous", role: "operator", tenantId: "" });
      fetchAgents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchAgents();
    const id = setInterval(fetchAgents, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token]);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) =>
      [a.name, a.type, a.role, a.status].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [agents, search]);

  return (
    <div>
      <PageHeader
        title="Agents"
        description={loading ? "Loading..." : `${agents.filter((a) => a.status === "active").length} active`}
        action="+ Provision Agent"
        onAction={() => setShowModal(true)}
        searchPlaceholder="Search agents..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {search ? "No agents match your search" : "No agents found"}
        </div>
      ) : (
        <div className="p-6 space-y-3">
          {filtered.map((agent) => (
            <Card key={agent.id} className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-sm font-mono font-semibold text-muted-foreground mt-0.5">
                      {agent.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{agent.name}</span>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            agent.status === "active" ? "bg-green-500" : agent.status === "pending_approval" ? "bg-yellow-500" : "bg-zinc-500"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.id}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 max-w-lg">{agent.description}</p>

                      <div className="flex items-center gap-2 mt-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[agent.type] ?? ""}`}>
                          {agent.type}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleColors[agent.role] ?? ""}`}>
                          {agent.role}
                        </span>
                        {(agent.collections ?? []).map((col: string) => (
                          <Badge key={col} variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">24h</p>
                        <p className="font-mono tabular-nums font-semibold text-sm">{(agent.actions24h ?? 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-mono tabular-nums font-semibold text-sm">{(agent.actionsTotal ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-2">
                      Last active {agent.lastActive}
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-3">
                      {agent.status === "pending_approval" && (
                        confirmAction?.id === agent.id ? (
                          <>
                            <span className="text-[11px] text-muted-foreground">
                              {confirmAction?.action === "approve" ? "Approve?" : "Reject?"}
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => handleApproval(agent.id, confirmAction!.action)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => setConfirmAction(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px] text-green-400"
                              onClick={() => setConfirmAction({ id: agent.id, action: "approve" })}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px] text-red-400"
                              onClick={() => setConfirmAction({ id: agent.id, action: "reject" })}
                            >
                              Reject
                            </Button>
                          </>
                        )
                      )}
                      {agent.status === "active" && (
                        <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => handleSuspend(agent.id)}>
                          Suspend
                        </Button>
                      )}
                      {agent.status === "suspended" && (
                        <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => handleReactivate(agent.id)}>
                          Reactivate
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => handleRotateKey(agent.id)}>
                        Rotate Key
                      </Button>
                      <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => router.push(`/agents/${agent.id}`)}>
                        View Logs
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Provision Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-4">Provision New Agent</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input className="mt-1 text-xs" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My Agent" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="autonomous">autonomous</option>
                  <option value="reactive">reactive</option>
                  <option value="supervised">supervised</option>
                  <option value="scheduled">scheduled</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Role</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                  <option value="reader">reader</option>
                  <option value="operator">operator</option>
                  <option value="developer">developer</option>
                  <option value="auditor">auditor</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tenant ID</label>
                <Input className="mt-1 text-xs font-mono" value={formData.tenantId} onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })} placeholder="tenant_..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleProvision} disabled={submitting || !formData.name || !formData.tenantId}>
                {submitting ? "Provisioning..." : "Provision"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      {successKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSuccessKey("")} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-green-500/30 bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <h2 className="text-sm font-semibold">Agent Provisioned Successfully</h2>
            </div>
            <p className="text-xs text-yellow-400 font-medium">
              Save this API key now — it will not be shown again.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">API Key</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 rounded border border-border bg-secondary px-3 py-2 text-xs font-mono break-all">{successKey}</code>
                <Button size="sm" variant="secondary" onClick={() => copyToClipboard(successKey, "agentKey")}>
                  {copiedField === "agentKey" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">MCP Connection Config (for Claude Desktop / MCP clients)</label>
              <div className="relative mt-1">
                <pre className="rounded border border-border bg-secondary px-3 py-2 text-xs font-mono break-all whitespace-pre-wrap overflow-x-auto">
                  {getMcpConfig(successKey)}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2 h-7 text-[11px]"
                  onClick={() => copyToClipboard(getMcpConfig(successKey), "agentMcp")}
                >
                  {copiedField === "agentMcp" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={() => setSuccessKey("")}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const POLL_INTERVAL = 15_000;

const EVENT_TYPE_OPTIONS = [
  "contacts.*",
  "contacts.created",
  "contacts.updated",
  "contacts.deleted",
  "companies.*",
  "companies.created",
  "companies.updated",
  "deals.*",
  "deals.created",
  "deals.updated",
  "deals.stage_changed",
  "cases.*",
  "cases.created",
  "cases.updated",
];

const statusColors: Record<string, string> = {
  success: "bg-green-500/15 text-green-400 border-green-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

interface Webhook {
  id: string;
  url: string;
  secret: string;
  eventTypes: string[];
  active: boolean;
  description: string | null;
  createdAt: string;
}

interface Delivery {
  id: number;
  webhookId: string;
  status: string;
  statusCode: number | null;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

export default function WebhooksPage() {
  const { token } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formEventTypes, setFormEventTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Delivery history panel
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const isFirst = useRef(true);

  const fetchWebhooks = useCallback(() => {
    apiFetch<Webhook[]>("/api/webhooks", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setWebhooks(data);
      })
      .catch(() => {})
      .finally(() => {
        if (isFirst.current) {
          setLoading(false);
          isFirst.current = false;
        }
      });
  }, [token]);

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchWebhooks();
    const id = setInterval(fetchWebhooks, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchWebhooks]);

  async function handleCreate() {
    if (!formUrl || formEventTypes.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/webhooks", {
        url: formUrl,
        eventTypes: formEventTypes,
        description: formDesc || undefined,
      }, token);
      setShowModal(false);
      setFormUrl("");
      setFormDesc("");
      setFormEventTypes([]);
      fetchWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(wh: Webhook) {
    try {
      await apiPatch(`/api/webhooks/${wh.id}`, { active: !wh.active }, token);
      fetchWebhooks();
    } catch {}
  }

  async function handleDelete(wh: Webhook) {
    try {
      await apiDelete(`/api/webhooks/${wh.id}`, token);
      if (selectedWebhook?.id === wh.id) setSelectedWebhook(null);
      fetchWebhooks();
    } catch {}
  }

  async function handleTest(wh: Webhook) {
    try {
      await apiPost(`/api/webhooks/${wh.id}/test`, {}, token);
      if (selectedWebhook?.id === wh.id) loadDeliveries(wh.id);
    } catch {}
  }

  async function loadDeliveries(webhookId: string) {
    setDeliveriesLoading(true);
    try {
      const data = await apiFetch<Delivery[]>(`/api/webhooks/${webhookId}/deliveries?limit=20`, { token });
      setDeliveries(Array.isArray(data) ? data : []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }

  function selectWebhook(wh: Webhook) {
    setSelectedWebhook(wh);
    loadDeliveries(wh.id);
  }

  function toggleEventType(et: string) {
    setFormEventTypes((prev) =>
      prev.includes(et) ? prev.filter((e) => e !== et) : [...prev, et]
    );
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description={loading ? "Loading..." : `${webhooks.length} registered`}
        action="+ New Webhook"
        onAction={() => setShowModal(true)}
      />

      <div className="flex">
        {/* Webhooks table */}
        <div className={`flex-1 ${selectedWebhook ? "border-r border-border" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              Loading webhooks...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              No webhooks registered
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">URL</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Event Types</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Active</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Created</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((wh) => (
                    <tr
                      key={wh.id}
                      className={`border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer ${
                        selectedWebhook?.id === wh.id ? "bg-secondary/40" : ""
                      }`}
                      onClick={() => selectWebhook(wh)}
                    >
                      <td className="px-4 py-2.5">
                        <div>
                          <span className="font-mono text-xs break-all">{wh.url}</span>
                          {wh.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{wh.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{wh.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {wh.eventTypes.map((et) => (
                            <Badge key={et} variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                              {et}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            wh.active ? "bg-green-500" : "bg-zinc-600"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(wh);
                          }}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                              wh.active ? "translate-x-[18px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs tabular-nums">
                        {wh.createdAt ? new Date(wh.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2" onClick={() => handleTest(wh)}>
                            Test
                          </Button>
                          <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 text-red-400 hover:text-red-300" onClick={() => handleDelete(wh)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delivery history panel */}
        {selectedWebhook && (
          <div className="w-96 shrink-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-semibold">Delivery History</h3>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedWebhook(null)}
              >
                Close
              </button>
            </div>
            {deliveriesLoading ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">Loading...</div>
            ) : deliveries.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">No deliveries yet</div>
            ) : (
              <div className="divide-y divide-border">
                {deliveries.map((d) => (
                  <div key={d.id} className="px-4 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          statusColors[d.status] ?? statusColors.pending
                        }`}
                      >
                        {d.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {d.statusCode ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        Attempt {d.attempts}/{d.maxAttempts}
                      </span>
                      <span className="font-mono tabular-nums">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Webhook Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-4">New Webhook</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Endpoint URL</label>
                <Input
                  className="mt-1 text-xs font-mono"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description (optional)</label>
                <Input
                  className="mt-1 text-xs"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="My webhook"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Event Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TYPE_OPTIONS.map((et) => (
                    <button
                      key={et}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-mono transition-colors ${
                        formEventTypes.includes(et)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                      }`}
                      onClick={() => toggleEventType(et)}
                    >
                      {et}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={submitting || !formUrl || formEventTypes.length === 0}
              >
                {submitting ? "Creating..." : "Create Webhook"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

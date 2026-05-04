"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface PipelineTrigger {
  id: string;
  pipelineId: string;
  triggerEvent: string;
  fromStage: string | null;
  toStage: string;
  active: boolean;
  createdAt: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Array<{ name: string; order: number; probability: number }>;
}

const TRIGGER_EVENTS = [
  "email.opened",
  "email.clicked",
  "email.replied",
  "email.delivered",
  "email.bounced",
];

export default function PipelineTriggersPage() {
  const { token } = useAuth();
  const [triggers, setTriggers] = useState<PipelineTrigger[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [pipelineId, setPipelineId] = useState("");
  const [triggerEvent, setTriggerEvent] = useState(TRIGGER_EVENTS[0]);
  const [fromStage, setFromStage] = useState("");
  const [toStage, setToStage] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [triggerRows, pipelineRows] = await Promise.all([
        apiFetch<PipelineTrigger[]>("/api/pipeline-triggers", { token }),
        apiFetch<Pipeline[]>("/api/pipelines", { token }),
      ]);
      setTriggers(triggerRows ?? []);
      setPipelines(pipelineRows ?? []);
      if (!pipelineId && pipelineRows?.[0]) setPipelineId(pipelineRows[0].id);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, pipelineId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const stageNames = selectedPipeline?.stages?.map((s) => s.name) ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !pipelineId || !toStage) return;
    setCreating(true);
    setError(null);
    try {
      await apiPost(
        "/api/pipeline-triggers",
        {
          pipelineId,
          triggerEvent,
          fromStage: fromStage || null,
          toStage,
          active: true,
        },
        token,
      );
      setFromStage("");
      setToStage("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm("Delete this trigger? Deals will no longer auto-advance on this event.")) return;
    try {
      await apiDelete(`/api/pipeline-triggers/${id}`, token);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <PageHeader
        title="Pipeline Triggers"
        description="Auto-advance deal stages on email engagement events. When a triggered event matches a deal in `fromStage`, the deal moves to `toStage`. Use `fromStage` blank to apply to any stage."
      />

      {error && (
        <div className="mb-4 p-3 rounded border border-destructive/30 bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium">Add a trigger</div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <label className="space-y-1 text-xs md:col-span-1">
              <span className="text-muted-foreground">Pipeline</span>
              <select
                className="w-full h-9 px-2 rounded border bg-background text-sm"
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                required
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs md:col-span-1">
              <span className="text-muted-foreground">Event</span>
              <select
                className="w-full h-9 px-2 rounded border bg-background text-sm"
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
              >
                {TRIGGER_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs md:col-span-1">
              <span className="text-muted-foreground">From stage (optional)</span>
              <select
                className="w-full h-9 px-2 rounded border bg-background text-sm"
                value={fromStage}
                onChange={(e) => setFromStage(e.target.value)}
              >
                <option value="">(any)</option>
                {stageNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs md:col-span-1">
              <span className="text-muted-foreground">To stage</span>
              <select
                className="w-full h-9 px-2 rounded border bg-background text-sm"
                value={toStage}
                onChange={(e) => setToStage(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {stageNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={creating || !pipelineId || !toStage}>
              {creating ? "Creating…" : "Add trigger"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && triggers.length === 0 && (
          <div className="text-sm text-muted-foreground p-6 border rounded-md text-center">
            No triggers yet. Add one above to auto-advance deals on email engagement.
          </div>
        )}
        {triggers.map((t) => {
          const pipelineName = pipelines.find((p) => p.id === t.pipelineId)?.name ?? t.pipelineId;
          return (
            <Card key={t.id}>
              <CardContent className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex-1 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{t.triggerEvent}</Badge>
                  <span className="text-muted-foreground">on</span>
                  <Badge variant="secondary">{pipelineName}</Badge>
                  <span className="text-muted-foreground">moves</span>
                  <Badge variant="outline">{t.fromStage ?? "any"}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge>{t.toStage}</Badge>
                  {!t.active && (
                    <Badge variant="destructive" className="ml-2">
                      inactive
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                  Delete
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

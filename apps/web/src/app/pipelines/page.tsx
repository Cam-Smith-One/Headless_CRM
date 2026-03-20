"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface PipelineStage {
  name: string;
  order: number;
  probability: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

const emptyStage = (): PipelineStage => ({ name: "", order: 0, probability: 0 });

export default function PipelinesPage() {
  const { token } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [formName, setFormName] = useState("");
  const [formStages, setFormStages] = useState<PipelineStage[]>([
    { name: "Prospecting", order: 0, probability: 10 },
    { name: "Qualification", order: 1, probability: 30 },
    { name: "Proposal", order: 2, probability: 50 },
    { name: "Negotiation", order: 3, probability: 70 },
    { name: "Closed Won", order: 4, probability: 100 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await apiFetch<Pipeline[]>("/api/pipelines", { token });
      setPipelines(data);

      // Fetch deal counts per pipeline
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (p) => {
          try {
            const res = await apiFetch<{ total: number }>(`/api/deals?pipelineId=${p.id}&limit=0`, { token });
            counts[p.id] = res.total ?? 0;
          } catch {
            counts[p.id] = 0;
          }
        })
      );
      setDealCounts(counts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  function openCreate() {
    setEditingPipeline(null);
    setFormName("");
    setFormStages([
      { name: "Prospecting", order: 0, probability: 10 },
      { name: "Qualification", order: 1, probability: 30 },
      { name: "Proposal", order: 2, probability: 50 },
      { name: "Negotiation", order: 3, probability: 70 },
      { name: "Closed Won", order: 4, probability: 100 },
    ]);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: Pipeline) {
    setEditingPipeline(p);
    setFormName(p.name);
    setFormStages([...p.stages].sort((a, b) => a.order - b.order));
    setError("");
    setShowModal(true);
  }

  function addStage() {
    setFormStages([...formStages, { ...emptyStage(), order: formStages.length }]);
  }

  function removeStage(index: number) {
    const next = formStages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setFormStages(next);
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= formStages.length) return;
    const next = [...formStages];
    [next[index], next[target]] = [next[target], next[index]];
    setFormStages(next.map((s, i) => ({ ...s, order: i })));
  }

  function updateStage(index: number, field: keyof PipelineStage, value: string | number) {
    const next = [...formStages];
    next[index] = { ...next[index], [field]: value };
    setFormStages(next);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = { name: formName, stages: formStages };
      if (editingPipeline) {
        await apiPatch(`/api/pipelines/${editingPipeline.id}`, payload, token);
      } else {
        await apiPost("/api/pipelines", payload, token);
      }
      setShowModal(false);
      fetchPipelines();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pipeline? This cannot be undone.")) return;
    try {
      await apiDelete(`/api/pipelines/${id}`, token);
      fetchPipelines();
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <PageHeader
        title="Pipelines"
        description={loading ? "Loading..." : `${pipelines.length} pipeline${pipelines.length !== 1 ? "s" : ""}`}
        action="+ New Pipeline"
        onAction={openCreate}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading pipelines...</div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
          <p>No pipelines yet</p>
          <Button size="sm" className="mt-4" onClick={openCreate}>Create your first pipeline</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {pipelines.map((p) => (
            <Card key={p.id} className="bg-card/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <p className="text-sm font-semibold">{p.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{p.stages.length} stages</span>
                      <span className="text-xs text-muted-foreground">{dealCounts[p.id] ?? 0} deals</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => openEdit(p)} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs text-red-400 hover:text-red-300" onClick={() => handleDelete(p.id)} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 7v5M8 7v5M11 7v5M4 4l1 10h6l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Button>
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="mt-3 border-t border-border pt-3 space-y-1.5">
                    {[...p.stages].sort((a, b) => a.order - b.order).map((stage) => (
                      <div key={stage.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{stage.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                          {stage.probability}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-sm font-semibold mb-4">
              {editingPipeline ? "Edit Pipeline" : "New Pipeline"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Pipeline Name</label>
                <Input
                  className="mt-1 text-xs"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sales Pipeline"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Stages</label>
                  <Button variant="secondary" size="sm" className="h-6 text-[11px]" onClick={addStage}>
                    + Add Stage
                  </Button>
                </div>
                <div className="space-y-2">
                  {formStages.map((stage, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-[10px] leading-none disabled:opacity-30"
                          onClick={() => moveStage(i, -1)}
                          disabled={i === 0}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-[10px] leading-none disabled:opacity-30"
                          onClick={() => moveStage(i, 1)}
                          disabled={i === formStages.length - 1}
                        >
                          ▼
                        </button>
                      </div>
                      <Input
                        className="text-xs flex-1"
                        value={stage.name}
                        onChange={(e) => updateStage(i, "name", e.target.value)}
                        placeholder="Stage name"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          className="text-xs w-16 text-right"
                          type="number"
                          min={0}
                          max={100}
                          value={stage.probability}
                          onChange={(e) => updateStage(i, "probability", parseInt(e.target.value) || 0)}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                        onClick={() => removeStage(i)}
                        disabled={formStages.length <= 1}
                      >
                        x
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !formName || formStages.length === 0}>
                {submitting ? "Saving..." : editingPipeline ? "Update Pipeline" : "Create Pipeline"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

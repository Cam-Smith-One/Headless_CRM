"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiFetchBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CustomFieldsFormFields } from "@/components/custom-fields";

interface Deal {
  id: string;
  name: string;
  value: string;
  companyId: string;
  createdByAgentId: string;
  daysInStage: number;
  stage?: string;
}

interface Stage {
  name: string;
  deals: Deal[];
}

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{ name: string; order: number; probability: number }>;
}

const DEFAULT_STAGE_ORDER = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won"];

const STAGE_COLOR_POOL = ["bg-zinc-500", "bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];

function getStageColor(index: number): string {
  return STAGE_COLOR_POOL[index % STAGE_COLOR_POOL.length];
}

function organizeDealsIntoStages(deals: any[], stageOrder: string[]): Stage[] {
  const stageMap: Record<string, Deal[]> = {};
  for (const name of stageOrder) stageMap[name] = [];

  for (const d of deals) {
    const stageName = d.stage ?? stageOrder[0] ?? "Prospecting";
    const val = typeof d.value === "number" ? `$${d.value.toLocaleString()}` : (d.value ?? "$0");
    const deal: Deal = {
      id: d.id,
      name: d.name,
      value: val,
      companyId: d.companyId ?? "",
      createdByAgentId: d.createdByAgentId ?? "",
      daysInStage: d.updatedAt ? Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    };
    if (stageMap[stageName]) {
      stageMap[stageName].push(deal);
    } else {
      stageMap[stageOrder[0]].push(deal);
    }
  }

  return stageOrder.map((name) => ({ name, deals: stageMap[name] }));
}

function parseDollarValue(v: string): number {
  return parseInt(v.replace(/[$,]/g, ""), 10) || 0;
}

const POLL_INTERVAL = 10_000;

export default function DealsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stageOrder, setStageOrder] = useState<string[]>(DEFAULT_STAGE_ORDER);
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGE_ORDER.map(name => ({ name, deals: [] })));
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const isFirst = useRef(true);
  const [formData, setFormData] = useState({ name: "", value: "", stage: "Prospecting", companyId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createCustomFields, setCreateCustomFields] = useState<Record<string, unknown>>({});

  // Fetch pipelines on mount
  useEffect(() => {
    apiFetch<PipelineOption[]>("/api/pipelines", { token })
      .then((data) => {
        if (data && data.length > 0) {
          setPipelineOptions(data);
          if (!selectedPipelineId) {
            setSelectedPipelineId(data[0].id);
            const sorted = [...data[0].stages].sort((a, b) => a.order - b.order);
            setStageOrder(sorted.map((s) => s.name));
          }
        }
      })
      .catch(() => {});
  }, [token]);

  const fetchDeals = useCallback(() => {
    const pipelineParam = selectedPipelineId ? `&pipelineId=${selectedPipelineId}` : "";
    apiFetch<any>(`/api/deals?limit=500${pipelineParam}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data;
        setAllDeals(data ?? []);
        setStages(organizeDealsIntoStages(data ?? [], stageOrder));
      })
      .catch(() => {})
      .finally(() => { if (isFirst.current) { setLoading(false); isFirst.current = false; } });
  }, [token, selectedPipelineId, stageOrder]);

  function handlePipelineChange(pipelineId: string) {
    setSelectedPipelineId(pipelineId);
    const p = pipelineOptions.find((pp) => pp.id === pipelineId);
    if (p) {
      const sorted = [...p.stages].sort((a, b) => a.order - b.order);
      setStageOrder(sorted.map((s) => s.name));
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        name: formData.name,
        stage: formData.stage,
      };
      if (formData.value) payload.value = formData.value;
      if (selectedPipelineId) payload.pipelineId = selectedPipelineId;
      if (formData.companyId) payload.companyId = formData.companyId;
      if (Object.keys(createCustomFields).length > 0) payload.customFields = createCustomFields;
      await apiPost("/api/deals", payload, token);
      setShowModal(false);
      setFormData({ name: "", value: "", stage: stageOrder[0] || "Prospecting", companyId: "" });
      setCreateCustomFields({});
      fetchDeals();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    isFirst.current = true;
    setLoading(true);
    fetchDeals();
    const id = setInterval(fetchDeals, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchDeals]);

  const filteredStages = useMemo(() => {
    if (!search.trim()) return stages;
    const q = search.toLowerCase();
    return stages.map((stage) => ({
      ...stage,
      deals: stage.deals.filter((d) =>
        [d.name, stage.name, d.companyId].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
      ),
    }));
  }, [stages, search]);

  const totalValue = stages.flatMap((s) => s.deals).reduce((acc, d) => acc + parseDollarValue(d.value), 0);

  return (
    <div>
      <PageHeader
        title="Deals"
        description={loading ? "Loading..." : `$${(totalValue / 1000).toFixed(0)}k total pipeline`}
        action="+ New Deal"
        onAction={() => setShowModal(true)}
        searchPlaceholder="Search deals..."
        searchValue={search}
        onSearchChange={setSearch}
        onExport={async () => {
          const blob = await apiFetchBlob("/api/deals/export?format=csv", { token });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "deals-export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading deals...</div>
      ) : (
        <>
        {pipelineOptions.length > 1 && (
          <div className="px-6 pt-4">
            <select
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground"
              value={selectedPipelineId}
              onChange={(e) => handlePipelineChange(e.target.value)}
            >
              {pipelineOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-3 p-6 overflow-x-auto">
          {filteredStages.map((stage, stageIndex) => {
            const stageValue = stage.deals.reduce((acc, d) => acc + parseDollarValue(d.value), 0);
            return (
              <div key={stage.name} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${getStageColor(stageIndex)}`} />
                    <span className="text-xs font-medium">{stage.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{stage.deals.length}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                    ${(stageValue / 1000).toFixed(0)}k
                  </span>
                </div>

                <div className="space-y-2">
                  {stage.deals.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">No deals</div>
                  ) : (
                    stage.deals.map((deal) => (
                      <Card key={deal.id} className="bg-card/50 hover:bg-card/80 transition-colors cursor-pointer" onClick={() => router.push(`/deals/${deal.id}`)}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <p className="text-[13px] font-medium leading-tight">{deal.name}</p>
                            <span className="text-[13px] font-mono tabular-nums font-semibold shrink-0 ml-2">
                              {deal.value}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">{deal.companyId || "—"}</p>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5">
                              {deal.createdByAgentId ? deal.createdByAgentId.slice(0, 12) + "…" : "—"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                              {deal.daysInStage}d
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-4">New Deal</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input className="mt-1 text-xs" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Value ($)</label>
                <Input className="mt-1 text-xs" type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} placeholder="50000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stage</label>
                <select className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground" value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })}>
                  {stageOrder.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Company ID (optional)</label>
                <Input className="mt-1 text-xs font-mono" value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} placeholder="co_..." />
              </div>
              <CustomFieldsFormFields collection="deals" values={createCustomFields} onChange={setCreateCustomFields} />
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !formData.name}>
                {submitting ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

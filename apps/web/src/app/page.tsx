"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  WIDGET_REGISTRY,
  getWidgetDef,
  WidgetRenderer,
} from "@/components/dashboard-widgets";

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "hcrm_dashboard_layout";

interface LayoutItem {
  id: string;
  span: 1 | 2 | 3;
}

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "metrics", span: 3 },
  { id: "activity", span: 2 },
  { id: "agents", span: 1 },
  { id: "pipeline", span: 1 },
];

function loadLayout(): LayoutItem[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: LayoutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    setLayout(loadLayout());
    setMounted(true);
  }, []);

  const persist = useCallback((next: LayoutItem[]) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────────

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const next = [...layout];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(dropIdx, 0, moved);
    persist(next);
    dragIdx.current = null;
  }

  function handleDragEnd() {
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  // ── Layout mutations ──────────────────────────────────────────────────

  function removeWidget(idx: number) {
    const next = layout.filter((_, i) => i !== idx);
    persist(next);
  }

  function addWidget(id: string) {
    const def = getWidgetDef(id);
    if (!def) return;
    persist([...layout, { id, span: def.defaultSpan }]);
  }

  function cycleSpan(idx: number) {
    const next = [...layout];
    const item = next[idx];
    const order: (1 | 2 | 3)[] = [1, 2, 3];
    const cur = order.indexOf(item.span);
    item.span = order[(cur + 1) % order.length];
    persist(next);
  }

  function resetLayout() {
    persist([...DEFAULT_LAYOUT]);
  }

  // Available widgets not currently in layout
  const unusedWidgets = WIDGET_REGISTRY.filter(
    (w) => !layout.some((l) => l.id === w.id)
  );

  // Suppress hydration flash — render nothing until client mount
  if (!mounted) {
    return (
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor agent activity and CRM health
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor agent activity and CRM health
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              All systems operational
            </div>
          )}

          {editing && unusedWidgets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium h-8 px-2.5"
              >
                + Add Widget
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {unusedWidgets.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    onSelect={() => addWidget(w.id)}
                  >
                    {w.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {editing && (
            <Button variant="outline" size="sm" onClick={resetLayout}>
              Reset
            </Button>
          )}

          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Done" : "Customize"}
          </Button>
        </div>
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-3 gap-4">
        {layout.map((item, idx) => {
          const def = getWidgetDef(item.id);
          const spanClass =
            item.span === 3
              ? "col-span-3"
              : item.span === 2
                ? "col-span-2"
                : "col-span-1";

          return (
            <div
              key={item.id}
              className={`${spanClass} ${dragOverIdx === idx ? "opacity-50" : ""}`}
              draggable={editing}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
            >
              <Card className="h-full">
                <CardContent className="p-4">
                  {/* Widget header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {editing && (
                        <span
                          className="cursor-grab active:cursor-grabbing text-muted-foreground select-none"
                          title="Drag to reorder"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <circle cx="5" cy="3" r="1.5" />
                            <circle cx="11" cy="3" r="1.5" />
                            <circle cx="5" cy="8" r="1.5" />
                            <circle cx="11" cy="8" r="1.5" />
                            <circle cx="5" cy="13" r="1.5" />
                            <circle cx="11" cy="13" r="1.5" />
                          </svg>
                        </span>
                      )}
                      <h2 className="text-sm font-medium">
                        {def?.title ?? item.id}
                      </h2>
                    </div>
                    {editing && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => cycleSpan(idx)}
                          title={`Span: ${item.span} col(s) — click to cycle`}
                        >
                          <span className="text-[10px] font-mono">
                            {item.span}c
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeWidget(idx)}
                          title="Remove widget"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Widget body */}
                  <WidgetRenderer widgetId={item.id} />
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {layout.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No widgets on the dashboard. Click <strong>Customize</strong> then{" "}
          <strong>Add Widget</strong> to get started, or <strong>Reset</strong>{" "}
          to restore defaults.
        </div>
      )}
    </div>
  );
}

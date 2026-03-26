"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface FieldDefinition {
  id: string;
  collection: string;
  fieldName: string;
  fieldType: string;
  required: boolean;
  options: string[] | null;
  description: string | null;
  displayOrder: number;
}

/** Hook to fetch custom field definitions for a collection */
export function useCustomFieldDefs(collection: string) {
  const { token } = useAuth();
  const [defs, setDefs] = useState<FieldDefinition[]>([]);

  useEffect(() => {
    apiFetch<FieldDefinition[]>(`/api/custom-fields?collection=${collection}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : [];
        setDefs(data);
      })
      .catch(() => setDefs([]));
  }, [collection, token]);

  return defs;
}

/** Display custom field values (read-only). Shows all defined fields, even empty ones. */
export function CustomFieldsDisplay({
  collection,
  customFields,
}: {
  collection: string;
  customFields: Record<string, unknown> | null | undefined;
}) {
  const defs = useCustomFieldDefs(collection);

  if (!defs.length) return null;

  const values = customFields ?? {};

  return (
    <div className="space-y-2 pt-2 border-t border-border mt-2">
      <h3 className="text-xs font-medium text-muted-foreground">Custom Fields</h3>
      {defs.map((def) => {
        const val = values[def.fieldName];
        let display: string;
        if (val === undefined || val === null || val === "") {
          display = "—";
        } else if (Array.isArray(val)) {
          display = val.length > 0 ? val.join(", ") : "—";
        } else if (typeof val === "boolean") {
          display = val ? "Yes" : "No";
        } else {
          display = String(val);
        }

        return (
          <div key={def.fieldName} className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {def.fieldName}
              {def.required && <span className="text-red-400 ml-0.5">*</span>}
            </span>
            <span className={`text-xs font-mono ${display === "—" ? "text-muted-foreground/50" : ""}`}>{display}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Inline editor for custom fields in create/edit forms */
export function CustomFieldsFormFields({
  collection,
  values,
  onChange,
}: {
  collection: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const defs = useCustomFieldDefs(collection);

  if (!defs.length) return null;

  function setValue(fieldName: string, value: unknown) {
    onChange({ ...values, [fieldName]: value });
  }

  return (
    <>
      {defs.length > 0 && (
        <div className="border-t border-border pt-3 mt-1">
          <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Custom Fields</p>
        </div>
      )}
      {defs.map((def) => {
        const val = values[def.fieldName];
        return (
          <div key={def.fieldName}>
            <label className="text-xs text-muted-foreground">
              {def.fieldName}
              {def.required && <span className="text-red-400 ml-0.5">*</span>}
              {def.description && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">({def.description})</span>
              )}
            </label>
            {def.fieldType === "boolean" ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => setValue(def.fieldName, e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground">{val ? "Yes" : "No"}</span>
              </div>
            ) : def.fieldType === "select" ? (
              <select
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground"
                value={String(val ?? "")}
                onChange={(e) => setValue(def.fieldName, e.target.value || undefined)}
              >
                <option value="">—</option>
                {(def.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : def.fieldType === "multiselect" ? (
              <select
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground"
                multiple
                value={Array.isArray(val) ? val as string[] : []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setValue(def.fieldName, selected);
                }}
              >
                {(def.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : def.fieldType === "number" ? (
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                value={val !== undefined && val !== null ? String(val) : ""}
                onChange={(e) => setValue(def.fieldName, e.target.value ? Number(e.target.value) : undefined)}
              />
            ) : def.fieldType === "date" ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                value={val ? String(val).slice(0, 10) : ""}
                onChange={(e) => setValue(def.fieldName, e.target.value || undefined)}
              />
            ) : (
              <input
                type={def.fieldType === "email" ? "email" : def.fieldType === "url" ? "url" : "text"}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                value={String(val ?? "")}
                onChange={(e) => setValue(def.fieldName, e.target.value || undefined)}
                placeholder={def.description ?? undefined}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

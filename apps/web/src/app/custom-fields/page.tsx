"use client";

import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const COLLECTIONS = ["contacts", "companies", "deals", "cases"] as const;
type Collection = (typeof COLLECTIONS)[number];

const FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "url",
  "email",
] as const;

interface FieldDefinition {
  id: string;
  tenantId: string;
  collection: string;
  fieldName: string;
  fieldType: string;
  required: boolean;
  options: string[] | null;
  defaultValue: unknown;
  description: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const collectionLabels: Record<Collection, string> = {
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  cases: "Cases",
};

const typeColors: Record<string, string> = {
  text: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  number: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  boolean: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  date: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  select: "bg-green-500/15 text-green-400 border-green-500/20",
  multiselect: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  url: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  email: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export default function CustomFieldsPage() {
  const { token } = useAuth();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    collection: "contacts" as Collection,
    fieldName: "",
    fieldType: "text" as string,
    required: false,
    options: "",
    description: "",
  });

  function fetchFields() {
    apiFetch<FieldDefinition[]>("/api/custom-fields", { token })
      .then(setFields)
      .catch(() => setFields([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    fetchFields();
  }, [token]);

  const grouped = useMemo(() => {
    const map: Record<string, FieldDefinition[]> = {};
    for (const c of COLLECTIONS) {
      map[c] = fields.filter((f) => f.collection === c);
    }
    return map;
  }, [fields]);

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const body: any = {
        collection: formData.collection,
        fieldName: formData.fieldName,
        fieldType: formData.fieldType,
        required: formData.required,
        description: formData.description || undefined,
      };
      if (
        (formData.fieldType === "select" || formData.fieldType === "multiselect") &&
        formData.options.trim()
      ) {
        body.options = formData.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
      }
      await apiPost("/api/custom-fields", body, token);
      setShowModal(false);
      setFormData({
        collection: "contacts",
        fieldName: "",
        fieldType: "text",
        required: false,
        options: "",
        description: "",
      });
      fetchFields();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/custom-fields/${id}`, token);
      fetchFields();
    } catch {
      // ignore
    }
  }

  const totalFields = fields.length;

  return (
    <div>
      <PageHeader
        title="Custom Fields"
        description={loading ? "Loading..." : `${totalFields} field definitions`}
        action="+ New Field"
        onAction={() => setShowModal(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Loading custom fields...
        </div>
      ) : totalFields === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          No custom fields defined yet
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {COLLECTIONS.map((collection) => {
            const collectionFields = grouped[collection];
            if (collectionFields.length === 0) return null;
            return (
              <div key={collection}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {collectionLabels[collection]}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Field Name
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Type
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Required
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Options
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Description
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground text-xs">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionFields.map((f) => (
                        <tr
                          key={f.id}
                          className="border-b border-border hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium">{f.fieldName}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[f.fieldType] ?? typeColors.text}`}
                            >
                              {f.fieldType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {f.required ? "Yes" : "No"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {f.options && Array.isArray(f.options) && f.options.length > 0
                              ? (f.options as string[]).join(", ")
                              : "\u2014"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {f.description || "\u2014"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 text-[11px] text-red-400 hover:text-red-300"
                              onClick={() => handleDelete(f.id)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-sm font-semibold mb-4">New Custom Field</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Collection</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  value={formData.collection}
                  onChange={(e) =>
                    setFormData({ ...formData, collection: e.target.value as Collection })
                  }
                >
                  {COLLECTIONS.map((c) => (
                    <option key={c} value={c}>
                      {collectionLabels[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Field Name</label>
                <Input
                  className="mt-1 text-xs"
                  value={formData.fieldName}
                  onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                  placeholder="e.g. linkedin_url"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Field Type</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  value={formData.fieldType}
                  onChange={(e) => setFormData({ ...formData, fieldType: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="required" className="text-xs text-muted-foreground">
                  Required
                </label>
              </div>
              {(formData.fieldType === "select" || formData.fieldType === "multiselect") && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Options (comma-separated)
                  </label>
                  <Input
                    className="mt-1 text-xs"
                    value={formData.options}
                    onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                    placeholder="option1, option2, option3"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Description (optional)</label>
                <Input
                  className="mt-1 text-xs"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this field for?"
                />
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
                disabled={submitting || !formData.fieldName}
              >
                {submitting ? "Creating..." : "Create Field"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

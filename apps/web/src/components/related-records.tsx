"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface RelatedRecord {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  href: string;
}

const statusColors: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  waiting: "bg-purple-500/15 text-purple-400",
  resolved: "bg-green-500/15 text-green-400",
  closed: "bg-zinc-500/15 text-zinc-400",
  active: "bg-green-500/15 text-green-400",
};

function RelatedList({ title, items, emptyText }: { title: string; items: RelatedRecord[]; emptyText: string }) {
  const router = useRouter();
  if (items.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">{title}</h3>
        <p className="text-xs text-muted-foreground/60 py-3">{emptyText}</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">{title} ({items.length})</h3>
      <div className="border border-border rounded-lg divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors cursor-pointer"
            onClick={() => router.push(item.href)}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{item.label}</p>
              {item.sublabel && <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>}
            </div>
            {item.badge && (
              <Badge variant="secondary" className={`text-[10px] font-mono px-1.5 py-0 h-5 shrink-0 ml-2 ${item.badgeColor || ""}`}>
                {item.badge}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Related contacts for a company */
export function CompanyContacts({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    apiFetch<any>(`/api/contacts?companyId=${companyId}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setItems(data.map((c: any) => ({
          id: c.id,
          label: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id,
          sublabel: c.email || c.title,
          badge: c.stateCode || "active",
          badgeColor: statusColors[c.stateCode || "active"],
          href: `/contacts/${c.id}`,
        })));
      })
      .catch(() => setItems([]));
  }, [companyId, token]);
  return <RelatedList title="Contacts" items={items} emptyText="No contacts at this company" />;
}

/** Related deals for a company */
export function CompanyDeals({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    apiFetch<any>(`/api/deals?companyId=${companyId}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setItems(data.map((d: any) => ({
          id: d.id,
          label: d.name,
          sublabel: d.value ? `$${Number(d.value).toLocaleString()}` : undefined,
          badge: d.stage,
          href: `/deals/${d.id}`,
        })));
      })
      .catch(() => setItems([]));
  }, [companyId, token]);
  return <RelatedList title="Deals" items={items} emptyText="No deals for this company" />;
}

/** Related cases for a company */
export function CompanyCases({ companyId }: { companyId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    apiFetch<any>(`/api/cases?companyId=${companyId}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setItems(data.map((c: any) => ({
          id: c.id,
          label: c.title,
          sublabel: c.category,
          badge: c.status,
          badgeColor: statusColors[c.status],
          href: `/cases/${c.id}`,
        })));
      })
      .catch(() => setItems([]));
  }, [companyId, token]);
  return <RelatedList title="Cases" items={items} emptyText="No cases for this company" />;
}

/** Related deals for a contact (via dealContacts junction) */
export function ContactDeals({ contactId }: { contactId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    // Query deals and filter by contact association
    // The API supports contactId filter on cases, but for deals we need to check dealContacts
    // For now, fetch all deals and we'll improve with a proper endpoint later
    apiFetch<any>(`/api/deals?limit=500`, { token })
      .then(async (res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        // Check each deal for this contact association
        const associated: RelatedRecord[] = [];
        for (const d of data) {
          try {
            const result = await apiFetch<any>(`/api/deals/${d.id}/contacts`, { token });
            if (result.contactIds?.includes(contactId)) {
              associated.push({
                id: d.id,
                label: d.name,
                sublabel: d.value ? `$${Number(d.value).toLocaleString()}` : undefined,
                badge: d.stage,
                href: `/deals/${d.id}`,
              });
            }
          } catch { /* skip */ }
        }
        setItems(associated);
      })
      .catch(() => setItems([]));
  }, [contactId, token]);
  return <RelatedList title="Deals" items={items} emptyText="No deals linked to this contact" />;
}

/** Related cases for a contact */
export function ContactCases({ contactId }: { contactId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    apiFetch<any>(`/api/cases?contactId=${contactId}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setItems(data.map((c: any) => ({
          id: c.id,
          label: c.title,
          sublabel: c.category,
          badge: c.status,
          badgeColor: statusColors[c.status],
          href: `/cases/${c.id}`,
        })));
      })
      .catch(() => setItems([]));
  }, [contactId, token]);
  return <RelatedList title="Cases" items={items} emptyText="No cases for this contact" />;
}

/** Contacts associated with a deal (via dealContacts junction) */
export function DealContacts({ dealId }: { dealId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");

  function load() {
    apiFetch<any>(`/api/deals/${dealId}/contacts`, { token })
      .then(async (res) => {
        const contactIds: string[] = res.contactIds ?? [];
        if (contactIds.length === 0) { setItems([]); return; }
        // Resolve contact details
        const resolved: RelatedRecord[] = [];
        for (const cid of contactIds) {
          try {
            const c = await apiFetch<any>(`/api/contacts/${cid}`, { token });
            resolved.push({
              id: c.id,
              label: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id,
              sublabel: c.email,
              href: `/contacts/${c.id}`,
            });
          } catch {
            resolved.push({ id: cid, label: cid, href: `/contacts/${cid}` });
          }
        }
        setItems(resolved);
      })
      .catch(() => setItems([]));
  }

  useEffect(() => { load(); }, [dealId, token]);

  async function handleAdd() {
    if (!selectedContactId) return;
    setAdding(true);
    try {
      await apiPost(`/api/deals/${dealId}/contacts`, { contactId: selectedContactId }, token);
      setShowAdd(false);
      setSelectedContactId("");
      load();
    } catch { /* handle */ }
    finally { setAdding(false); }
  }

  async function handleRemove(contactId: string) {
    try {
      await apiDelete(`/api/deals/${dealId}/contacts/${contactId}`, token);
      load();
    } catch { /* handle */ }
  }

  // Fetch contacts list when adding
  useEffect(() => {
    if (showAdd && allContacts.length === 0) {
      apiFetch<any>("/api/contacts?limit=200", { token })
        .then((res) => setAllContacts(Array.isArray(res) ? res : res?.data ?? []))
        .catch(() => {});
    }
  }, [showAdd, token]);

  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground">Contacts ({items.length})</h3>
        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Contact"}
        </Button>
      </div>
      {showAdd && (
        <div className="flex gap-2 mb-2">
          <select
            className="flex-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
          >
            <option value="">Select contact...</option>
            {allContacts
              .filter((c) => !items.some((i) => i.id === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id}
                </option>
              ))}
          </select>
          <Button size="sm" className="h-7 text-[11px]" onClick={handleAdd} disabled={adding || !selectedContactId}>
            {adding ? "..." : "Add"}
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-3">No contacts linked to this deal</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <div className="min-w-0 cursor-pointer flex-1" onClick={() => router.push(item.href)}>
                <p className="text-[13px] font-medium truncate">{item.label}</p>
                {item.sublabel && <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-muted-foreground hover:text-red-400 shrink-0 ml-2"
                onClick={() => handleRemove(item.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cases linked to a deal */
export function DealCases({ dealId }: { dealId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<RelatedRecord[]>([]);
  useEffect(() => {
    apiFetch<any>(`/api/cases?dealId=${dealId}`, { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setItems(data.map((c: any) => ({
          id: c.id,
          label: c.title,
          sublabel: c.category,
          badge: c.status,
          badgeColor: statusColors[c.status],
          href: `/cases/${c.id}`,
        })));
      })
      .catch(() => setItems([]));
  }, [dealId, token]);
  return <RelatedList title="Cases" items={items} emptyText="No cases linked to this deal" />;
}

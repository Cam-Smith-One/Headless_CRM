"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiFetch } from "@/lib/api";
import { useSession, signOut } from "@headless-crm/auth-web/client";

const navItems = [
  {
    label: "Overview",
    href: "/",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Companies",
    href: "/companies",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 7h2M5 10h2M9 7h2M9 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Deals",
    href: "/deals",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v12M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="12" width="12" height="2" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Pipelines",
    href: "/pipelines",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h9M2 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Pipeline Triggers",
    href: "/pipeline-triggers",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3-3 4 4 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="13" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Cases",
    href: "/cases",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 6h6M5 8.5h6M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Agents",
    href: "/agents",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="2" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6.5" cy="6.5" r="1" fill="currentColor" />
        <circle cx="9.5" cy="6.5" r="1" fill="currentColor" />
        <path d="M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Activity",
    href: "/activity",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8h3l2-5 2 10 2-5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Webhooks",
    href: "/webhooks",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v4M8 10v4M2 8h4M10 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const bottomItems = [
  {
    label: "Custom Fields",
    href: "/custom-fields",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="8" width="8" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 9.5h-1M14 9.5h-0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 12.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Team",
    href: "/settings/team",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 14c0-2.5 2-4.5 4.5-4.5S10 11.5 10 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 10c1.5.3 3 1.5 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "API Docs",
    href: "/api/docs",
    external: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface SearchResult {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  domain?: string;
  similarity?: number;
}

function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<{ contacts: SearchResult[]; companies: SearchResult[] }>({ contacts: [], companies: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ contacts: [], companies: [] });
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      if (semantic) {
        const [contactRes, companyRes] = await Promise.all([
          apiFetch<{ data: SearchResult[] }>(`/api/search/semantic?q=${encodeURIComponent(q)}&collection=contacts&limit=5`),
          apiFetch<{ data: SearchResult[] }>(`/api/search/semantic?q=${encodeURIComponent(q)}&collection=companies&limit=5`),
        ]);
        setResults({ contacts: contactRes.data, companies: companyRes.data });
      } else {
        const [contactRes, companyRes] = await Promise.all([
          apiFetch<{ data: SearchResult[] }>(`/api/contacts?search=${encodeURIComponent(q)}&limit=5`),
          apiFetch<{ data: SearchResult[] }>(`/api/companies?search=${encodeURIComponent(q)}&limit=5`),
        ]);
        setResults({ contacts: contactRes.data, companies: companyRes.data });
      }
      setOpen(true);
    } catch {
      setResults({ contacts: [], companies: [] });
    } finally {
      setLoading(false);
    }
  }, [semantic]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = results.contacts.length > 0 || results.companies.length > 0;

  return (
    <div className="mt-1 px-2 relative" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          placeholder="Search records..."
          className="flex-1 bg-transparent outline-none text-sidebar-foreground placeholder:text-muted-foreground text-xs"
        />
        <button
          type="button"
          onClick={() => setSemantic((s) => !s)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-mono border transition-colors",
            semantic
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-sidebar-foreground"
          )}
          title={semantic ? "Semantic search (AI)" : "Text search"}
        >
          {semantic ? "AI" : "Txt"}
        </button>
      </div>

      {open && (hasResults || loading || query.trim()) && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-md border border-border bg-background shadow-lg max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          )}
          {!loading && !hasResults && query.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No results found</div>
          )}
          {results.contacts.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Contacts</div>
              {results.contacts.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent/50 transition-colors flex items-center justify-between"
                  onClick={() => { setOpen(false); setQuery(""); router.push(`/contacts/${r.id}`); }}
                >
                  <span className="text-sidebar-foreground truncate">
                    {[r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || r.id}
                  </span>
                  {r.similarity != null && (
                    <span className="text-[10px] text-muted-foreground ml-2">{(r.similarity * 100).toFixed(0)}%</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {results.companies.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Companies</div>
              {results.companies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent/50 transition-colors flex items-center justify-between"
                  onClick={() => { setOpen(false); setQuery(""); router.push(`/companies/${r.id}`); }}
                >
                  <span className="text-sidebar-foreground truncate">{r.name || r.domain || r.id}</span>
                  {r.similarity != null && (
                    <span className="text-[10px] text-muted-foreground ml-2">{(r.similarity * 100).toFixed(0)}%</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  async function handleSignOut() {
    await signOut();
    localStorage.removeItem("hcrm_token");
    localStorage.removeItem("hcrm_admin_key");
    router.push("/login");
  }

  useEffect(() => {
    function fetchUnread() {
      apiFetch<{ count: number }>("/api/notifications/unread-count")
        .then((res) => setUnreadNotifications(res.count))
        .catch(() => {});
    }
    fetchUnread();
    const nid = setInterval(fetchUnread, 15_000);
    return () => clearInterval(nid);
  }, []);

  useEffect(() => {
    function fetchPending() {
      apiFetch<{ count: number }>("/api/approvals/pending")
        .then((res) => setPendingApprovals(res.count))
        .catch(() => {});
    }
    fetchPending();
    const id = setInterval(fetchPending, 15_000);
    return () => clearInterval(id);
  }, []);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-56 flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-xl overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Headless CRM" width={84} height={84} className="rounded-xl object-cover" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-sidebar-foreground leading-none">
            Headless CRM
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 font-mono">
            v0.1.3
          </p>
        </div>
      </div>

      <SearchBox />

      <nav className="mt-4 flex-1 px-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                {item.label}
                {item.label === "Approvals" && pendingApprovals > 0 && (
                  <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
                    {pendingApprovals}
                  </span>
                )}
                {item.label === "Notifications" && unreadNotifications > 0 && (
                  <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border px-2 py-2">
        <div className="space-y-0.5">
          {bottomItems.map((item) => {
            const isExternal = "external" in item && item.external;
            const isActive = !isExternal && pathname.startsWith(item.href);
            if (isExternal) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5">
          {/* Avatar — first letter of name, or "?" if no session */}
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {session?.user?.name ?? "Loading…"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {session?.user?.email ?? ""}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Link href="/notifications" className="relative p-1 rounded-md hover:bg-sidebar-accent/50 transition-colors text-muted-foreground hover:text-sidebar-foreground" title="Notifications">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
            <ThemeToggle />
            {/* Sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="p-1 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 11l3-3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

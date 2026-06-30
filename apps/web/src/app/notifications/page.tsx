"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  tenantId: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string | null;
  recordType: string | null;
  recordId: string | null;
  agentId: string | null;
  read: boolean;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  error: "bg-red-500/15 text-red-400 border-red-500/20",
  success: "bg-green-500/15 text-green-400 border-green-500/20",
};

const typeIcons: Record<string, string> = {
  info: "i",
  warning: "!",
  error: "x",
  success: "✓",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getRecordHref(recordType: string | null, recordId: string | null): string | null {
  if (!recordType || !recordId) return null;
  const map: Record<string, string> = {
    contacts: "/contacts",
    companies: "/companies",
    deals: "/deals",
    cases: "/cases",
    approvals: "/approvals",
    agents: "/agents",
  };
  const base = map[recordType];
  if (!base) return null;
  if (recordType === "approvals" || recordType === "agents") return base;
  return `${base}/${recordId}`;
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const isFirst = useRef(true);

  const fetchNotifications = useCallback(() => {
    apiFetch<{ data: Notification[] }>("/api/notifications", { token })
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setNotifications(data);
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
    fetchNotifications();
    const id = setInterval(fetchNotifications, 10_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  async function handleMarkAllRead() {
    try {
      await apiPost("/api/notifications/read-all", {}, token);
      fetchNotifications();
    } catch {
      // ignore
    }
  }

  async function handleClick(n: Notification) {
    // Mark as read
    if (!n.read) {
      try {
        await apiPost(`/api/notifications/${n.id}/read`, {}, token);
      } catch {
        // ignore
      }
    }
    // Navigate to the related record
    const href = getRecordHref(n.recordType, n.recordId);
    if (href) {
      router.push(href);
    } else {
      // Just refresh to show read state
      fetchNotifications();
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={loading ? "Loading..." : `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        action={unreadCount > 0 ? "Mark all read" : undefined}
        onAction={unreadCount > 0 ? handleMarkAllRead : undefined}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="none" className="mb-3 opacity-40">
            <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          No notifications yet
        </div>
      ) : (
        <div className="px-4 space-y-1">
          {notifications.map((n) => {
            const href = getRecordHref(n.recordType, n.recordId);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  n.read
                    ? "border-border bg-card hover:bg-sidebar-accent/30"
                    : "border-border bg-sidebar-accent/40 hover:bg-sidebar-accent/60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    typeColors[n.type] ?? typeColors.info
                  )}>
                    {typeIcons[n.type] ?? "i"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        n.read ? "text-muted-foreground" : "text-sidebar-foreground font-medium"
                      )}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      {n.recordType && (
                        <span className="text-[10px] text-muted-foreground font-mono">{n.recordType}</span>
                      )}
                      {href && (
                        <span className="text-[10px] text-blue-400">View record</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

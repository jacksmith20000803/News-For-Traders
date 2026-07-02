"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, LayoutGrid, List, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn, formatRelative } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: unknown;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type NotificationsData = {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: Pagination;
};

type ViewMode = "list" | "grid";

export function NotificationsManager({ initialData }: { initialData: NotificationsData }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialData.notifications);
  const [pagination, setPagination] = useState<Pagination>(initialData.pagination);
  const [unreadCount, setUnreadCount] = useState(initialData.unreadCount);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const visibleIds = useMemo(() => notifications.map((item) => item.id), [notifications]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const loadNotifications = useCallback(async (page: number) => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });
      const response = await fetch(`/api/notifications?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<NotificationsData>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Could not load notifications");
      setNotifications(json.data.notifications);
      setUnreadCount(json.data.unreadCount);
      setPagination(json.data.pagination);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications(pagination.page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications, pagination.page]);

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set();
      return new Set([...current, ...visibleIds]);
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markAllRead() {
    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      const json = await readJsonResponse<ApiResponse<{ message: string }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not mark notifications as read");
      setMessage(json.data?.message ?? "All notifications marked as read.");
      await loadNotifications(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark notifications as read");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedIds.size) {
      setMessage("Select at least one notification first.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected notification(s)?`)) return;

    await deleteNotifications({ ids: Array.from(selectedIds) });
  }

  async function deleteAll() {
    if (!window.confirm("Delete all of your notifications?")) return;
    await deleteNotifications({ all: true });
  }

  async function deleteNotifications(payload: { ids?: string[]; all?: boolean }) {
    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/notifications", {
        method: "DELETE",
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not delete notifications");
      setMessage(`Deleted ${json.data?.deleted ?? 0} notification(s).`);
      await loadNotifications(Math.min(pagination.page, pagination.totalPages));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete notifications");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {pagination.total} total notifications. {unreadCount} unread.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void loadNotifications(pagination.page)}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" size="sm" variant="success" onClick={markAllRead} disabled={loading}>
                <CheckCheck className="h-4 w-4" />
                Mark read
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={deleteSelected} disabled={loading}>
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={deleteAll} disabled={loading}>
                Delete all
              </Button>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-primary" />
              Select all visible
            </label>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>

          {message ? (
            <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {notifications.length ? (
        <div className={cn("grid gap-3", view === "grid" && "md:grid-cols-2 xl:grid-cols-3")}>
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              selected={selectedIds.has(notification.id)}
              view={view}
              onToggle={() => toggleSelected(notification.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-card/95">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
            <Bell className="h-10 w-10 text-primary/50" />
            <p className="text-base font-semibold text-foreground">No notifications</p>
            <p>Replies, news alerts, and system updates will appear here.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page <= 1}
          onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-border bg-background/90 p-1 shadow-inner">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn("rounded-xl px-3 py-2 transition", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")}
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn("rounded-xl px-3 py-2 transition", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")}
        aria-label="Card view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}

function NotificationRow({
  notification,
  selected,
  view,
  onToggle,
}: {
  notification: NotificationItem;
  selected: boolean;
  view: ViewMode;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-3xl border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl",
        !notification.read && "border-primary/35 bg-primary/5",
        selected && "border-primary/70 ring-2 ring-primary/20",
        view === "list" && "grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          aria-label={`Select ${notification.title}`}
        />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="outline">{notification.type}</Badge>
            {!notification.read ? <Badge variant="primary">New</Badge> : null}
          </div>
          <h2 className="text-base font-bold text-foreground">{notification.title}</h2>
          <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{notification.message}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground lg:text-right">{formatRelative(notification.createdAt)}</p>
    </article>
  );
}

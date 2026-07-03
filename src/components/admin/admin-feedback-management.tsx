"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, MessageSquareReply, RefreshCw, Search, Trash2 } from "lucide-react";
import type { FeedbackStatus, FeedbackType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type FeedbackItem = {
  id: string;
  type: FeedbackType;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar: string | null; username: string | null } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ManagementData = {
  items: FeedbackItem[];
  pagination: Pagination;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ViewMode = "list" | "grid";

const statuses: Array<FeedbackStatus | "ALL"> = ["ALL", "NEW", "IN_PROGRESS", "REPLIED", "CLOSED"];

export function AdminFeedbackManagement({ initialData }: { initialData: ManagementData }) {
  const [items, setItems] = useState(initialData.items);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "ALL">("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const loadItems = useCallback(
    async (page: number, q = activeQuery, nextStatus = status) => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
          ...(q ? { q } : {}),
          ...(nextStatus !== "ALL" ? { status: nextStatus } : {}),
        });
        const response = await fetch(`/api/admin/feedback?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = await readJsonResponse<ApiResponse<ManagementData>>(response);
        if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load feedback");
        setItems(json.data.items);
        setPagination(json.data.pagination);
        setSelectedIds(new Set());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load feedback");
      } finally {
        setLoading(false);
      }
    },
    [activeQuery, pagination.limit, status]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(pagination.page), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems, pagination.page]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setActiveQuery(query.trim());
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => (allSelected ? new Set() : new Set([...current, ...visibleIds])));
  }

  async function replySelected() {
    if (!selectedIds.size) {
      setMessage("Select at least one feedback item first.");
      return;
    }
    const reply = window.prompt(`Reply to ${selectedIds.size} selected feedback item(s):`)?.trim();
    if (!reply) {
      setMessage("Reply text is required.");
      return;
    }

    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds), reply }),
      });
      const json = await readJsonResponse<ApiResponse<{ updated: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Failed to send reply");
      setMessage(`Replied to ${json.data?.updated ?? 0} feedback item(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send reply");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedIds.size) {
      setMessage("Select at least one feedback item first.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected feedback item(s)?`)) return;

    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/feedback", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Failed to delete feedback");
      setMessage(`Deleted ${json.data?.deleted ?? 0} feedback item(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sender, email, subject, or message"
                className="h-11 w-full rounded-2xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </form>
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as FeedbackStatus | "ALL");
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                className="select-polished h-10 px-3 text-sm"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "All statuses" : item.toLowerCase()}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadItems(pagination.page)}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={() => void replySelected()} className="bg-emerald-600 text-white hover:bg-emerald-500">
                <MessageSquareReply className="h-4 w-4" />
                Reply selected
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()} className="bg-red-700 text-white hover:bg-red-600">
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
              Select all visible
            </label>
            <span>
              {pagination.total} feedback items, page {pagination.page} of {pagination.totalPages}
            </span>
          </div>

          {message ? (
            <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
        {items.map((item) => (
          <FeedbackRow
            key={item.id}
            item={item}
            view={view}
            selected={selectedIds.has(item.id)}
            onToggle={() => toggleSelected(item.id)}
          />
        ))}
      </div>

      {!items.length && !loading ? (
        <Card className="bg-card/95">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No feedback matches the current filters.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
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

function FeedbackRow({
  item,
  view,
  selected,
  onToggle,
}: {
  item: FeedbackItem;
  view: ViewMode;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "group rounded-3xl border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl",
        selected && "border-primary/70 ring-2 ring-primary/20",
        view === "list" && "grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"
      )}
    >
      <div className="min-w-0">
        <div className="mb-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            aria-label={`Select ${item.subject}`}
          />
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline">{item.type.toLowerCase()}</Badge>
              <Badge variant={item.status === "NEW" ? "warning" : item.status === "REPLIED" ? "success" : "outline"}>{item.status.toLowerCase()}</Badge>
            </div>
            <h2 className="line-clamp-2 text-base font-bold text-foreground sm:text-lg">{item.subject}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.message}</p>
          </div>
        </div>
        {item.adminReply ? (
          <div className="ml-7 mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
            <span className="font-semibold">Reply:</span> {item.adminReply}
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm">
        <p className="font-semibold text-foreground">{item.user?.name ?? item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{item.user?.email ?? item.email}</p>
        {item.user?.username ? <p className="mt-1 text-xs text-muted-foreground">@{item.user.username}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, RefreshCw, Search, Trash2 } from "lucide-react";
import type { AuditAction } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type AuditLogItem = {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { name: string; email: string };
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

type ManagementData = {
  items: AuditLogItem[];
  pagination: Pagination;
};

type ViewMode = "list" | "grid";

export function AdminAuditManagement({ initialData }: { initialData: ManagementData }) {
  const [items, setItems] = useState<AuditLogItem[]>(initialData.items);
  const [pagination, setPagination] = useState<Pagination>(initialData.pagination);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const loadItems = useCallback(async (page: number, q = activeQuery) => {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        ...(q ? { q } : {}),
      });
      const response = await fetch(`/api/admin/audit?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<ManagementData>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load audit logs");
      setItems(json.data.items);
      setPagination(json.data.pagination);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [activeQuery, pagination.limit]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems(pagination.page, activeQuery);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeQuery, loadItems, pagination.page]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setActiveQuery(query.trim());
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
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

  async function deleteSelected() {
    if (!selectedIds.size) {
      setMessage("Select at least one audit log first.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected audit log(s)?`)) return;

    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/audit", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Failed to delete audit logs");
      setMessage(`Deleted ${json.data?.deleted ?? 0} audit log(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete audit logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search action, admin, target, or IP"
                className="h-11 w-full rounded-2xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </form>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadItems(pagination.page)}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={deleteSelected} disabled={loading}>
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
              {pagination.total} logs, page {pagination.page} of {pagination.totalPages}
            </span>
          </div>

          {message ? (
            <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className={cn("grid gap-3", view === "grid" && "md:grid-cols-2 xl:grid-cols-3")}>
        {items.map((item) => (
          <AuditManagementRow
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
            No audit logs match the current filters.
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

function AuditManagementRow({
  item,
  view,
  selected,
  onToggle,
}: {
  item: AuditLogItem;
  view: ViewMode;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-3xl border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl",
        selected && "border-primary/70 ring-2 ring-primary/20",
        view === "list" && "grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_170px]"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          aria-label={`Select ${item.action}`}
        />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="primary">{item.action.replace(/_/g, " ").toLowerCase()}</Badge>
            {item.targetType ? <Badge variant="outline">{item.targetType}</Badge> : null}
          </div>
          <h2 className="truncate text-base font-bold text-foreground">{item.admin.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{item.admin.email}</p>
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-foreground">{item.targetId ?? "No target id"}</p>
        <p className="truncate text-muted-foreground">{item.ipAddress ?? "IP unavailable"}</p>
      </div>
      <p className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</p>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Pin, RefreshCw, Search, Trash2 } from "lucide-react";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type NewsItem = {
  id: string;
  headline: string;
  summary: string | null;
  importance: ImportanceLevel;
  reliabilityStatus: ReliabilityStatus;
  isPinned: boolean;
  publishedAt: string;
  sourceUrl: string | null;
  source: { id: string; name: string; reliabilityScore: number };
  category: { id: string; name: string } | null;
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
  items: NewsItem[];
  pagination: Pagination;
};

type ViewMode = "list" | "grid";

export function AdminNewsManagement({ initialData }: { initialData: ManagementData }) {
  const [items, setItems] = useState<NewsItem[]>(initialData.items);
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
      const response = await fetch(`/api/admin/news?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<ManagementData>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load news");
      setItems(json.data.items);
      setPagination(json.data.pagination);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load news");
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
      setMessage("Select at least one news item first.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected news item(s)?`)) return;

    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/news", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Failed to delete news");
      setMessage(`Deleted ${json.data?.deleted ?? 0} news item(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete news");
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setActiveQuery(query.trim());
    setPagination((current) => ({ ...current, page: 1 }));
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
                placeholder="Search headline, source, or category"
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
              {pagination.total} items, page {pagination.page} of {pagination.totalPages}
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
          <NewsManagementRow
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
            No news items match the current filters.
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

function NewsManagementRow({
  item,
  view,
  selected,
  onToggle,
}: {
  item: NewsItem;
  view: ViewMode;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-3xl border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl",
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
            aria-label={`Select ${item.headline}`}
          />
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-base font-bold text-foreground sm:text-lg">
              {item.isPinned ? <Pin className="mr-1 inline h-4 w-4 text-primary" /> : null}
              {item.headline}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {stripHtml(item.summary ?? "No summary provided.")}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.source.name}</Badge>
          {item.category ? <Badge variant="primary">{item.category.name}</Badge> : null}
          <Badge variant={importanceVariant(item.importance)}>{item.importance.toLowerCase()}</Badge>
          <Badge variant={reliabilityVariant(item.reliabilityStatus)}>{item.reliabilityStatus.toLowerCase()}</Badge>
        </div>
        <p className="text-muted-foreground">{formatDate(item.publishedAt)}</p>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Open source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function importanceVariant(value: ImportanceLevel) {
  if (value === "CRITICAL" || value === "HIGH") return "warning" as const;
  if (value === "LOW") return "outline" as const;
  return "primary" as const;
}

function reliabilityVariant(value: ReliabilityStatus) {
  if (value === "VERIFIED") return "success" as const;
  if (value === "DISPUTED" || value === "RETRACTED") return "danger" as const;
  return "outline" as const;
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

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

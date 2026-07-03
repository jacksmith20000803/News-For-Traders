"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LayoutGrid, List, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import type { ContentStatus, PostCategory } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { CountryFlag, countryDisplayName } from "@/components/ui/country-flag";

type ArticleItem = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: PostCategory;
  status: ContentStatus;
  createdAt: string;
  publishedAt: string | null;
  author: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    country: string | null;
    timezone: string | null;
    registrationAudit: {
      country: string | null;
      city: string | null;
      deviceType: string | null;
      browser: string | null;
      os: string | null;
    } | null;
    visitorActivities: Array<{
      country: string | null;
      region: string | null;
      city: string | null;
      timezone: string | null;
    }>;
  };
  tags: Array<{ tag: { name: string } }>;
  _count: { likes: number; comments: number };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ManagementData = {
  items: ArticleItem[];
  pagination: Pagination;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ViewMode = "list" | "grid";
type ArticleAction = "approve" | "reject" | "delete";

const statuses: Array<ContentStatus | "ALL"> = ["ALL", "PENDING", "PUBLISHED", "REJECTED", "ARCHIVED", "DRAFT"];

export function AdminArticleManagement({ initialData }: { initialData: ManagementData }) {
  const [items, setItems] = useState<ArticleItem[]>(initialData.items);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [status, setStatus] = useState<ContentStatus | "ALL">("ALL");
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
        const response = await fetch(`/api/admin/articles?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = await readJsonResponse<ApiResponse<ManagementData>>(response);
        if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load articles");
        setItems(json.data.items);
        setPagination(json.data.pagination);
        setSelectedIds(new Set());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load articles");
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

  function toggleAll() {
    setSelectedIds((current) => (allSelected ? new Set() : new Set([...current, ...visibleIds])));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: ArticleAction) {
    if (!selectedIds.size) {
      setMessage("Select at least one article first.");
      return;
    }
    const reason =
      action === "approve"
        ? undefined
        : window.prompt(`Reason for ${action === "reject" ? "rejecting" : "deleting"} the selected article(s):`)?.trim();
    if (action !== "approve" && !reason) {
      setMessage("A reason is required for rejection or deletion.");
      return;
    }

    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/articles", {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds), action, reason }),
      });
      const json = await readJsonResponse<ApiResponse<{ updated: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Action failed");
      setMessage(`Updated ${json.data?.updated ?? 0} article(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
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
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, author, or content"
                className="h-11 w-full rounded-2xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </form>
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(event) => {
                  const nextStatus = event.target.value as ContentStatus | "ALL";
                  setStatus(nextStatus);
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
              <Button type="button" size="sm" variant="outline" onClick={() => void loadItems(pagination.page)}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={() => void runAction("approve")} className="bg-emerald-600 text-white hover:bg-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void runAction("reject")} className="bg-red-700 text-white hover:bg-red-600">
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void runAction("delete")} className="bg-red-800 text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" />
                Delete
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
              {pagination.total} articles, page {pagination.page} of {pagination.totalPages}
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
          <ArticleRow
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
            No community articles match the current filters.
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

function ArticleRow({
  item,
  view,
  selected,
  onToggle,
}: {
  item: ArticleItem;
  view: ViewMode;
  selected: boolean;
  onToggle: () => void;
}) {
  const preview = item.excerpt ?? item.content.slice(0, 180);
  const latestLocation = item.author.visitorActivities[0];
  const country = latestLocation?.country ?? item.author.country ?? item.author.registrationAudit?.country ?? null;
  const location = [
    countryDisplayName(country),
    latestLocation?.region,
    latestLocation?.city ?? item.author.registrationAudit?.city,
  ]
    .filter(Boolean)
    .join(", ");
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
            aria-label={`Select ${item.title}`}
          />
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-base font-bold text-foreground sm:text-lg">{item.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-7">
          <Badge variant={statusVariant(item.status)}>{item.status.toLowerCase()}</Badge>
          <Badge variant="outline">{item.category.toLowerCase()}</Badge>
          {item.tags.slice(0, 4).map(({ tag }) => (
            <Badge key={tag.name} variant="outline">
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm">
        <div className="flex items-center gap-3">
          {item.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.author.avatar} alt={item.author.name} className="h-10 w-10 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
              {item.author.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{item.author.name}</p>
            <p className="truncate text-xs text-muted-foreground">{item.author.email}</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <CountryFlag countryCode={country} className="h-4 w-4" />
          <span className="truncate">{location || "Location unavailable"}</span>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString()} - {item._count.likes} likes - {item._count.comments} comments
        </p>
      </div>
    </article>
  );
}

function statusVariant(status: ContentStatus) {
  if (status === "PUBLISHED") return "success";
  if (status === "REJECTED" || status === "ARCHIVED") return "danger";
  return "warning";
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Grid3X3, ImagePlus, List, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { getCsrfToken, readJsonResponse, secureFetch } from "@/lib/api/client";
import type { CommunityMediaItem, CommunityMediaType } from "@/lib/community/media-types";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type MediaView = "grid" | "list";
type MediaFilter = CommunityMediaType | "ALL";

export function AdminCommunityMediaManager() {
  const [items, setItems] = useState<CommunityMediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<MediaView>("grid");
  const [type, setType] = useState<MediaFilter>("ALL");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [formType, setFormType] = useState<CommunityMediaType>("EMOJI");
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadItems = useCallback(
    async (mode: "reset" | "append" = "reset", requestedCursor = 0) => {
      const nextCursor = mode === "append" ? requestedCursor : 0;
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({
          type,
          cursor: String(nextCursor),
          limit: "24",
          ...(query.trim() ? { q: query.trim() } : {}),
        });
        const response = await fetch(`/api/admin/community-media?${params}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await readJsonResponse<
          ApiResponse<{ items: CommunityMediaItem[]; nextCursor: number; hasMore: boolean; total: number }>
        >(response);
        if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load media.");
        setItems((current) => (mode === "append" ? [...current, ...json.data!.items] : json.data!.items));
        setCursor(json.data.nextCursor);
        setHasMore(json.data.hasMore);
        if (mode === "reset") setSelectedIds(new Set());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load media.");
      } finally {
        setLoading(false);
      }
    },
    [query, type]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadItems("reset", 0), 180);
    return () => window.clearTimeout(timeout);
  }, [loadItems]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasMore && !loading) void loadItems("append", cursor);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadItems, loading]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addMedia(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData();
    formData.append("type", formType);
    formData.append("name", formName.trim());
    formData.append("value", formValue.trim());
    formData.append("url", formUrl.trim());
    if (formFile) formData.append("file", formFile);

    setLoading(true);
    try {
      const response = await fetch("/api/admin/community-media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": await getCsrfToken() },
        body: formData,
      });
      const json = await readJsonResponse<ApiResponse<{ item: CommunityMediaItem }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Could not add media.");
      setFormName("");
      setFormValue("");
      setFormUrl("");
      setFormFile(null);
      setMessage("Media added.");
      await loadItems("reset", 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add media.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedIds.size) {
      setMessage("Select media first.");
      return;
    }
    setLoading(true);
    try {
      const response = await secureFetch("/api/admin/community-media", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not delete media.");
      setMessage(`Deleted ${json.data?.deleted ?? 0} item${json.data?.deleted === 1 ? "" : "s"}.`);
      await loadItems("reset", 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete media.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAllFiltered() {
    if (!window.confirm("Delete every media item matching the current search and type filter?")) return;
    setLoading(true);
    try {
      const response = await secureFetch("/api/admin/community-media", {
        method: "DELETE",
        body: JSON.stringify({ all: true, q: query.trim(), type }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not delete media.");
      setMessage(`Deleted ${json.data?.deleted ?? 0} filtered item${json.data?.deleted === 1 ? "" : "s"}.`);
      await loadItems("reset", 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete media.");
    } finally {
      setLoading(false);
    }
  }

  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  return (
    <div className="space-y-4">
      <div className="rounded-[1.4rem] border border-border bg-card/95 p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Community chat media</p>
            <h2 className="text-lg font-black text-foreground">Emoticons, stickers, and GIFs</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search media"
                className="h-10 w-56 rounded-2xl border border-border bg-background/90 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as MediaFilter)}
              className="select-polished h-10 px-3 text-sm"
            >
              {["ALL", "EMOJI", "STICKER", "GIF"].map((item) => (
                <option key={item} value={item}>{item.toLowerCase()}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setView((current) => (current === "grid" ? "list" : "grid"))}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background/85 px-3 text-sm font-bold text-foreground hover:bg-muted"
            >
              {view === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              {view === "grid" ? "List" : "Cards"}
            </button>
            <button
              type="button"
              onClick={() => void loadItems("reset")}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background/85 px-3 text-sm font-bold text-foreground hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(items.map((item) => item.id)))}
              className="inline-flex h-10 items-center rounded-2xl border border-border bg-background/85 px-3 text-sm font-bold text-foreground hover:bg-muted"
            >
              {allVisibleSelected ? "Clear selection" : "Select loaded"}
            </button>
            <button
              type="button"
              onClick={() => void deleteSelected()}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-red-600 px-3 text-sm font-black text-white hover:bg-red-500"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => void deleteAllFiltered()}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-3 text-sm font-black text-red-600 hover:bg-red-500/15 dark:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
              Delete all filtered
            </button>
          </div>
        </div>

        <form onSubmit={addMedia} className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/60 p-3 lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            value={formType}
            onChange={(event) => setFormType(event.target.value as CommunityMediaType)}
            className="select-polished h-11 px-3 text-sm"
          >
            <option value="EMOJI">emoji</option>
            <option value="STICKER">sticker</option>
            <option value="GIF">gif</option>
          </select>
          <input
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            placeholder="Accurate name"
            className="h-11 rounded-2xl border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
          />
          <input
            value={formType === "EMOJI" ? formValue : formUrl}
            onChange={(event) => (formType === "EMOJI" ? setFormValue(event.target.value) : setFormUrl(event.target.value))}
            placeholder={formType === "EMOJI" ? "Emoji character" : "Optional asset URL"}
            className="h-11 rounded-2xl border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
          />
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm font-bold text-muted-foreground hover:bg-muted">
            <UploadCloud className="h-4 w-4" />
            {formFile?.name ?? "Upload file"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => setFormFile(event.target.files?.[0] ?? null)}
              disabled={formType === "EMOJI"}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{items.length} loaded</span>
          <span>{selectedIds.size} selected</span>
        </div>
        {message ? <p className="mt-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">{message}</p> : null}
      </div>

      <div className={cn(view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "space-y-2")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleSelected(item.id)}
            className={cn(
              "text-left transition hover:-translate-y-0.5",
              view === "grid"
                ? "overflow-hidden rounded-[1.25rem] border border-border bg-card/95 p-3 shadow-sm"
                : "flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-sm",
              selectedIds.has(item.id) && "border-primary/70 ring-2 ring-primary/25"
            )}
          >
            <MediaPreview item={item} compact={view === "list"} />
            <div className={cn(view === "grid" ? "mt-3" : "min-w-0 flex-1")}>
              <p className="truncate text-sm font-black text-foreground">{item.name}</p>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.type.toLowerCase()}</p>
            </div>
          </button>
        ))}
      </div>

      <div ref={sentinelRef} className="flex h-12 items-center justify-center text-sm text-muted-foreground">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : hasMore ? "Scroll for more" : "End of media"}
      </div>
    </div>
  );
}

function MediaPreview({ item, compact }: { item: CommunityMediaItem; compact?: boolean }) {
  if (item.type === "EMOJI") {
    return (
      <span className={cn("flex items-center justify-center rounded-2xl border border-border bg-background/80 text-3xl shadow-inner", compact ? "h-12 w-12" : "h-24 w-full")}>
        {item.value}
      </span>
    );
  }

  return (
    <span className={cn("flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-background/80 shadow-inner", compact ? "h-12 w-12" : "aspect-video w-full")}>
      {item.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
      )}
    </span>
  );
}

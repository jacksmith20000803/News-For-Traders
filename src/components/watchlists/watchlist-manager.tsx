"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, GripVertical, Trash2, Bell, TrendingUp, TrendingDown } from "lucide-react";
import { secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/assets/symbols";
import type { AssetCategory, AlertType, AlertChannel } from "@prisma/client";

interface WatchlistItem {
  id: string;
  symbol: string;
  assetType: string;
  category: AssetCategory;
  sortOrder: number;
  quote?: { price: number; changePercent: number | null } | null;
}

interface Watchlist {
  id: string;
  name: string;
  category: AssetCategory | null;
  sortOrder: number;
  items: WatchlistItem[];
  _count?: { items: number; alerts: number };
}

export function WatchlistManager() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragWatchlistId, setDragWatchlistId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addSymbol, setAddSymbol] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/watchlists");
    const json = await res.json();
    if (json.success) setWatchlists(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createWatchlist = async () => {
    if (!newName.trim()) return;
    await secureFetch("/api/watchlists", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    load();
  };

  const addItem = async (watchlistId: string) => {
    const symbol = addSymbol[watchlistId]?.trim().toUpperCase();
    if (!symbol) return;
    await secureFetch(`/api/watchlists/${watchlistId}`, {
      method: "POST",
      body: JSON.stringify({ symbol, assetType: "stock", category: "STOCKS" }),
    });
    setAddSymbol((s) => ({ ...s, [watchlistId]: "" }));
    load();
  };

  const removeItem = async (watchlistId: string, itemId: string) => {
    await secureFetch(`/api/watchlists/${watchlistId}/items/${itemId}`, { method: "DELETE" });
    load();
  };

  const createAlert = async (item: WatchlistItem, watchlistId: string) => {
    await secureFetch("/api/alerts", {
      method: "POST",
      body: JSON.stringify({
        symbol: item.symbol,
        assetType: item.assetType,
        watchlistId,
        alertType: "PERCENT_CHANGE" as AlertType,
        threshold: 2,
        channels: "BOTH" as AlertChannel,
      }),
    });
    load();
  };

  const onItemDrop = async (watchlistId: string, targetItemId: string) => {
    if (!dragItemId || dragItemId === targetItemId) return;
    const wl = watchlists.find((w) => w.id === watchlistId);
    if (!wl) return;

    const ids = wl.items.map((i) => i.id);
    const fromIdx = ids.indexOf(dragItemId);
    const toIdx = ids.indexOf(targetItemId);
    if (fromIdx < 0 || toIdx < 0) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragItemId);

    await secureFetch(`/api/watchlists/${watchlistId}`, {
      method: "POST",
      body: JSON.stringify({ itemIds: ids }),
    });
    setDragItemId(null);
    load();
  };

  const onWatchlistDrop = async (targetId: string) => {
    if (!dragWatchlistId || dragWatchlistId === targetId) return;
    const ids = watchlists.map((w) => w.id);
    const fromIdx = ids.indexOf(dragWatchlistId);
    const toIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragWatchlistId);

    await secureFetch("/api/watchlists", {
      method: "PATCH",
      body: JSON.stringify({ watchlistIds: ids }),
    });
    setDragWatchlistId(null);
    load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`wl-sk-${i}`} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New watchlist name…"
          className="flex-1 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
        />
        <Button onClick={createWatchlist} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      {watchlists.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No watchlists yet</p>
      ) : (
        watchlists.map((wl) => (
          <div
            key={wl.id}
            draggable
            onDragStart={() => setDragWatchlistId(wl.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onWatchlistDrop(wl.id)}
            className="dash-panel rounded-2xl p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <h2 className="font-semibold">{wl.name}</h2>
              {wl.category && (
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">
                  {CATEGORY_LABELS[wl.category]}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{wl.items.length} assets</span>
            </div>

            <div className="space-y-1 mb-3">
              {wl.items.map((item) => {
                const slug = item.symbol.replace(/[\/=]/g, "").toUpperCase();
                const positive = (item.quote?.changePercent ?? 0) >= 0;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItemId(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onItemDrop(wl.id, item.id)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                    <Link
                      href={`/assets/${slug}`}
                      className="font-mono text-sm font-medium text-cyan-400 hover:underline min-w-[80px]"
                    >
                      {item.symbol}
                    </Link>
                    {item.quote && (
                      <>
                        <span className="font-mono text-xs tabular-nums">{item.quote.price.toFixed(2)}</span>
                        <span
                          className={cn(
                            "flex items-center gap-0.5 font-mono text-xs tabular-nums",
                            positive ? "text-accent" : "text-destructive"
                          )}
                        >
                          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {item.quote.changePercent != null
                            ? `${positive ? "+" : ""}${item.quote.changePercent.toFixed(2)}%`
                            : "—"}
                        </span>
                      </>
                    )}
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        onClick={() => createAlert(item, wl.id)}
                        className="rounded p-1 text-muted-foreground hover:text-cyan-400"
                        title="Create price alert"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(wl.id, item.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                value={addSymbol[wl.id] ?? ""}
                onChange={(e) => setAddSymbol((s) => ({ ...s, [wl.id]: e.target.value }))}
                placeholder="Add symbol (e.g. AAPL, BTC)"
                className="flex-1 rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-mono"
                onKeyDown={(e) => e.key === "Enter" && addItem(wl.id)}
              />
              <Button size="sm" variant="outline" onClick={() => addItem(wl.id)}>
                Add
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

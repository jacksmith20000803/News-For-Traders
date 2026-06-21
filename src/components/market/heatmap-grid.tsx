"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { intensityToColor } from "@/lib/market/heatmap";
import type { AssetCategory } from "@prisma/client";

interface HeatmapCell {
  symbol: string;
  assetType: string;
  category: AssetCategory;
  name: string | null;
  price: number;
  changePercent: number;
  intensity: number;
}

const TABS: { value: AssetCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "STOCKS", label: "Stocks" },
  { value: "FOREX", label: "Forex" },
  { value: "CRYPTO", label: "Crypto" },
];

export function HeatmapGrid() {
  const [category, setCategory] = useState<string>("");
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = category ? `?category=${category}` : "";
    fetch(`/api/heatmap${q}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCells(json.data.cells ?? []);
      })
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setCategory(tab.value === "ALL" ? "" : tab.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              (tab.value === "ALL" && !category) || category === tab.value
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                : "bg-white/5 text-muted-foreground border border-transparent hover:bg-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={`hm-sk-${i}`} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : cells.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No market data — configure providers and run ingestion
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {cells.map((cell) => {
            const slug = cell.symbol.replace(/[\/=]/g, "").toUpperCase();
            return (
              <Link
                key={`${cell.symbol}-${cell.assetType}`}
                href={`/assets/${slug}`}
                className="rounded-xl p-3 transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: intensityToColor(cell.intensity) }}
              >
                <p className="font-mono text-xs font-bold text-white">{cell.symbol}</p>
                <p className="mt-1 font-mono text-sm text-white/90 tabular-nums">
                  {cell.price.toFixed(cell.price < 10 ? 4 : 2)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-mono text-xs font-semibold tabular-nums",
                    cell.changePercent >= 0 ? "text-emerald-200" : "text-red-200"
                  )}
                >
                  {cell.changePercent >= 0 ? "+" : ""}
                  {cell.changePercent.toFixed(2)}%
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { AssetCategory } from "@prisma/client";

export interface HeatmapCell {
  symbol: string;
  assetType: string;
  category: AssetCategory;
  name: string | null;
  price: number;
  changePercent: number;
  intensity: number; // -1 to 1 normalized
}

function normalizeIntensity(changePercent: number, maxAbs: number): number {
  if (maxAbs === 0) return 0;
  return Math.max(-1, Math.min(1, changePercent / maxAbs));
}

function mapAssetTypeToCategory(assetType: string): AssetCategory {
  switch (assetType) {
    case "forex":
      return "FOREX";
    case "crypto":
      return "CRYPTO";
    case "commodity":
      return "COMMODITIES";
    case "index":
      return "INDICES";
    default:
      return "STOCKS";
  }
}

export async function getHeatmapData(category?: AssetCategory): Promise<HeatmapCell[]> {
  const quotes = await db.marketQuote.findMany({ orderBy: { changePercent: "desc" } });

  let filtered = quotes.map((q) => ({
    symbol: q.symbol,
    assetType: q.assetType,
    category: mapAssetTypeToCategory(q.assetType),
    name: q.name,
    price: q.price,
    changePercent: q.changePercent ?? 0,
    intensity: 0,
  }));

  if (category) {
    filtered = filtered.filter((q) => q.category === category);
  }

  const maxAbs = Math.max(...filtered.map((q) => Math.abs(q.changePercent)), 1);
  return filtered.map((q) => ({
    ...q,
    intensity: normalizeIntensity(q.changePercent, maxAbs),
  }));
}

export const getCachedHeatmap = unstable_cache(
  async (category?: string) => getHeatmapData(category as AssetCategory | undefined),
  ["market-heatmap"],
  { revalidate: 60 }
);

export function intensityToColor(intensity: number): string {
  if (intensity > 0) {
    const g = Math.round(40 + intensity * 160);
    return `rgb(16, ${g}, 80)`;
  }
  const r = Math.round(40 + Math.abs(intensity) * 180);
  return `rgb(${r}, 40, 50)`;
}

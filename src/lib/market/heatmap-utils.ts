/** Client-safe heatmap helpers — no database or Prisma dependencies. */

export type HeatmapCategory =
  | "STOCKS"
  | "FOREX"
  | "CRYPTO"
  | "COMMODITIES"
  | "INDICES";

export interface HeatmapCellData {
  symbol: string;
  assetType: string;
  category: HeatmapCategory;
  name: string | null;
  price: number;
  changePercent: number;
  intensity: number;
}

export const HEATMAP_TABS: { value: HeatmapCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "STOCKS", label: "Stocks" },
  { value: "FOREX", label: "Forex" },
  { value: "CRYPTO", label: "Crypto" },
];

export function intensityToColor(intensity: number): string {
  if (intensity > 0) {
    const g = Math.round(40 + intensity * 160);
    return `rgb(16, ${g}, 80)`;
  }
  const r = Math.round(40 + Math.abs(intensity) * 180);
  return `rgb(${r}, 40, 50)`;
}

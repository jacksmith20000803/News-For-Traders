import { HeatmapGrid } from "@/components/market/heatmap-grid";

export const metadata = { title: "Market Heatmap" };

export default function HeatmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Market Heatmap</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visual performance across stocks, forex, and crypto
        </p>
      </div>
      <HeatmapGrid />
    </div>
  );
}

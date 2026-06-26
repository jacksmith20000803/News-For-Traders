import { db } from "@/lib/db";
import Link from "next/link";

export default async function AssetsPage() {
  const assetProfiles = await db.assetProfile.findMany({
    orderBy: { symbol: "asc" },
    take: 50,
  });

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Market Assets</h1>
          <p className="text-muted-foreground">Browse all available trading assets</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assetProfiles.map((asset) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.symbol}`}
              className="p-4 rounded-lg border border-white/10 bg-card hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{asset.symbol}</span>
                <span className="text-xs text-muted-foreground">{asset.assetType}</span>
              </div>
              <p className="text-sm text-muted-foreground">{asset.name}</p>
            </Link>
          ))}
        </div>

        {assetProfiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No assets available at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

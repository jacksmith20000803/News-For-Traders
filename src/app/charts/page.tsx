import { TradingChart } from "@/components/charts/trading-chart";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { connection } from "next/server";

export const metadata = { title: "Charts" };

export default async function ChartsPage() {
  await connection();

  const user = await getCurrentUser();
  
  let prefs = null;
  let favorites: string[] = [];
  
  if (user) {
    const [userPrefs, userFavorites] = await Promise.all([
      db.userPreferences.findUnique({ where: { userId: user.id } }),
      db.favoriteAsset.findMany({ where: { userId: user.id }, orderBy: { sortOrder: "asc" } }),
    ]);
    prefs = userPrefs;
    favorites = userFavorites.map((f) => `${f.symbol}:${f.assetType}`);
  }

  return (
    <div className="mx-auto min-h-full max-w-[1800px] px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Real-Time Charts</h1>
        <p className="text-base text-gray-600 dark:text-gray-400 mt-2">
          TradingView Lightweight Charts with candlesticks, volume, and indicators
        </p>
      </div>
      <TradingChart
        initialSymbol={prefs?.defaultSymbol ?? "BTC/USD"}
        favorites={favorites}
      />
    </div>
  );
}

import { db } from "@/lib/db";
import { NewsViewToggle } from "@/components/news/news-view-toggle";
import { NewsGridClient } from "@/components/news/news-grid-client";
import { getCurrentUser } from "@/lib/auth/session";
import { Search, ChevronDown, Heart } from "lucide-react";

export default async function NewsPage() {
  const user = await getCurrentUser();

  const [news, assetProfiles, marketQuotes, newsAssets, favoriteBookmarks] = await Promise.all([
    db.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        headline: true,
        summary: true,
        publishedAt: true,
        importance: true,
        reliabilityStatus: true,
        imageUrl: true,
        source: {
          select: {
            name: true,
          },
        },
        assets: {
          select: {
            symbol: true,
            assetType: true,
          },
        },
      },
    }),
    db.assetProfile.findMany({
      where: { category: "CRYPTO" },
      select: { symbol: true },
      orderBy: { symbol: "asc" },
      take: 300,
    }),
    db.marketQuote.findMany({
      where: { assetType: { contains: "crypto", mode: "insensitive" } },
      select: { symbol: true },
      orderBy: { symbol: "asc" },
      take: 300,
    }),
    db.newsAsset.findMany({
      where: { assetType: { contains: "crypto", mode: "insensitive" } },
      select: { symbol: true },
      distinct: ["symbol"],
      orderBy: { symbol: "asc" },
      take: 300,
    }),
    user
      ? db.bookmark.findMany({
          where: { userId: user.id, newsId: { not: null } },
          select: { newsId: true },
        })
      : Promise.resolve([]),
  ]);

  const normalizeCoin = (symbol: string) => symbol.toUpperCase().replace(/\/USD$/, "");
  const allCoins = Array.from(
    new Set(
      [...assetProfiles, ...marketQuotes, ...newsAssets]
        .map((item) => normalizeCoin(item.symbol))
        .filter(Boolean)
    )
  ).sort();

  const initialFavoriteIds = favoriteBookmarks
    .map((bookmark) => bookmark.newsId)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="min-h-full" suppressHydrationWarning>
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div suppressHydrationWarning>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Market News</h1>
            <p className="text-gray-600 dark:text-gray-400">Latest market updates and analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <NewsViewToggle />
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search news..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-[#0a0c0c] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-cyan-500/50 transition-colors"
              id="news-search"
            />
          </div>
          <div className="relative">
            <select
              id="coin-filter"
              className="appearance-none bg-white dark:bg-[#0a0c0c] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white px-4 py-2 pr-10 rounded-lg focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
            >
              <option value="">All Coins</option>
              {allCoins.map(coin => (
                <option key={coin} value={coin} className="bg-white dark:bg-[#0a0c0c]">
                  {coin}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0a0c0c] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              id="favorites-filter"
            >
              <Heart className="h-4 w-4" />
              Favorites
            </button>
          </div>
        </div>

        <NewsGridClient news={news} initialFavoriteIds={initialFavoriteIds} />

        {news.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No news articles available at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

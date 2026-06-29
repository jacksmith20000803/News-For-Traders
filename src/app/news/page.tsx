import { db } from "@/lib/db";
import { NewsViewToggle } from "@/components/news/news-view-toggle";
import { NewsGridClient } from "@/components/news/news-grid-client";
import { getCurrentUser } from "@/lib/auth/session";

const DEFAULT_NEWS_COINS = [
  "ADA",
  "ATOM",
  "AVAX",
  "BNB",
  "BTC",
  "DOGE",
  "DOT",
  "ETH",
  "EUR",
  "LINK",
  "LTC",
  "SOL",
  "UNI",
  "XRP",
];

export default async function NewsPage() {
  const user = await getCurrentUser();

  const [news, newsAssets] = await Promise.all([
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
    db.newsAsset.findMany({
      where: { assetType: { contains: "crypto", mode: "insensitive" } },
      select: { symbol: true },
      distinct: ["symbol"],
      orderBy: { symbol: "asc" },
      take: 200,
    }),
  ]);

  const favoriteBookmarks = user
    ? await db.bookmark.findMany({
        where: { userId: user.id, newsId: { in: news.map((item) => item.id) } },
        select: { newsId: true },
      })
    : [];

  const normalizeCoin = (symbol: string) => symbol.toUpperCase().replace(/\/USD$/, "");
  const allCoins = Array.from(
    new Set(
      [...newsAssets.map((item) => item.symbol), ...DEFAULT_NEWS_COINS]
        .map((symbol) => normalizeCoin(symbol))
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

        <NewsGridClient news={news} initialFavoriteIds={initialFavoriteIds} allCoins={allCoins} />

        {news.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No news articles available at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

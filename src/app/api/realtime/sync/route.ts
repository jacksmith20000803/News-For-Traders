import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { getFallbackNews, getFallbackQuotes, mergeFallbackQuotes } from "@/lib/fallback-data";
import { queueMarketQuoteRefresh } from "@/lib/market/realtime-fetcher";

export async function GET() {
  try {
    queueMarketQuoteRefresh(1000);

    const [quotes, news] = await Promise.all([
      db.marketQuote.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
      db.news.findMany({
        select: { id: true, headline: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
    ]);

    return apiSuccess({
      quotes: mergeFallbackQuotes(quotes).map((q) => ({
        symbol: q.symbol,
        assetType: q.assetType,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        updatedAt: q.updatedAt instanceof Date ? q.updatedAt.toISOString() : q.updatedAt,
      })),
      news,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return apiSuccess({
        quotes: getFallbackQuotes().map((q) => ({
          symbol: q.symbol,
          assetType: q.assetType,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          updatedAt: q.updatedAt,
        })),
        news: getFallbackNews(3).map((item) => ({
          id: item.id,
          headline: item.headline,
          publishedAt: item.publishedAt,
        })),
        degraded: true,
        syncedAt: new Date().toISOString(),
      });
    }
    return handleApiError(error);
  }
}

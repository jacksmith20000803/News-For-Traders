import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [quotes, news] = await Promise.all([
      db.marketQuote.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
      db.news.findMany({
        select: { id: true, headline: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
    ]);

    return apiSuccess({
      quotes: quotes.map((q) => ({
        symbol: q.symbol,
        assetType: q.assetType,
        price: q.price,
        changePercent: q.changePercent,
        updatedAt: q.updatedAt.toISOString(),
      })),
      news,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

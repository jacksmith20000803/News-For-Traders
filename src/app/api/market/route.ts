import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { isAnyProviderConfigured, getProviderStatuses } from "@/lib/providers/news";
import { updateMarketQuotes } from "@/lib/market/realtime-fetcher";
import { toAssetSlug } from "@/lib/assets/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get("sync") === "true";
    const symbol = searchParams.get("symbol");
    const assetType = searchParams.get("assetType");

    // Trigger sync if requested
    if (sync) {
      await updateMarketQuotes();
    }

    if (symbol) {
      const normalized = symbol.toUpperCase();
      const slug = toAssetSlug(normalized);
      const symbolWhere = {
        OR: [
          { symbol: normalized },
          { symbol: slug },
          { symbol: `${slug}/USD` },
          { symbol: { contains: slug, mode: "insensitive" as const } },
        ],
      };
      const quote = await db.marketQuote.findFirst({
        where: assetType ? { AND: [{ assetType }, symbolWhere] } : symbolWhere,
        orderBy: { updatedAt: "desc" },
      });

      return apiSuccess({
        configured: isAnyProviderConfigured(),
        providers: getProviderStatuses(),
        quote,
        quotes: quote ? [quote] : [],
      });
    }

    const quotes = await db.marketQuote.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return apiSuccess({
      configured: isAnyProviderConfigured(),
      providers: getProviderStatuses(),
      quotes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

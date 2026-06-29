import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { isAnyProviderConfigured, getProviderStatuses } from "@/lib/providers/news";
import { queueMarketQuoteRefresh } from "@/lib/market/realtime-fetcher";
import { toAssetSlug } from "@/lib/assets/symbols";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { getFallbackQuotes, mergeFallbackQuotes } from "@/lib/fallback-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get("sync") === "true";
    const symbol = searchParams.get("symbol");
    const assetType = searchParams.get("assetType");

    if (sync) {
      queueMarketQuoteRefresh(100);
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
      const fallbackQuotes = getFallbackQuotes().filter((item) => {
        const fallbackSlug = toAssetSlug(item.symbol);
        return fallbackSlug === slug || toAssetSlug(item.symbol.replace("/USD", "")) === slug;
      });

      return apiSuccess({
        configured: safeIsAnyProviderConfigured(),
        providers: safeProviderStatuses(),
        quote: quote ?? fallbackQuotes[0] ?? null,
        quotes: quote ? [quote] : fallbackQuotes,
      });
    }

    const quotes = await db.marketQuote.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return apiSuccess({
      configured: safeIsAnyProviderConfigured(),
      providers: safeProviderStatuses(),
      quotes: mergeFallbackQuotes(quotes),
    });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) {
      console.error("[market] Falling back after quote API error:", error);
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const assetType = searchParams.get("assetType");
    const quotes = getFallbackQuotes().filter((quote) => {
      if (assetType && quote.assetType !== assetType) return false;
      if (!symbol) return true;
      const slug = toAssetSlug(symbol.toUpperCase());
      return [quote.symbol, toAssetSlug(quote.symbol), quote.symbol.replace("/USD", "")]
        .map((value) => toAssetSlug(value))
        .includes(slug);
    });

    return apiSuccess({
      configured: false,
      providers: safeProviderStatuses(),
      degraded: true,
      quote: symbol ? quotes[0] ?? null : null,
      quotes,
    });
  }
}

function safeProviderStatuses() {
  try {
    return getProviderStatuses();
  } catch {
    return [];
  }
}

function safeIsAnyProviderConfigured() {
  try {
    return isAnyProviderConfigured();
  } catch {
    return false;
  }
}

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { getFallbackQuotes } from "@/lib/fallback-data";
import { toAssetSlug } from "@/lib/assets/symbols";

interface CoinGeckoHistoricalData {
  prices: [number, number][];
  market_caps?: [number, number][];
  total_volumes?: [number, number][];
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  ETC: "ethereum-classic",
};

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `historical:${ip}`,
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTC";
    const compactSymbol = rawSymbol.toUpperCase().replace("/USD", "");
    const dbSymbols = [rawSymbol.toUpperCase(), `${compactSymbol}/USD`, compactSymbol];
    const coinGeckoId = COINGECKO_IDS[compactSymbol] ?? rawSymbol.toLowerCase();
    const days = parseInt(searchParams.get("days") || "730"); // 2 years default

    // Check if we have recent data in the database
    const twoYearsAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const existingData = await db.priceHistory.findMany({
      where: {
        symbol: { in: dbSymbols },
        timestamp: {
          gte: twoYearsAgo,
        },
      },
      orderBy: {
        timestamp: "asc",
      },
      take: 1,
    });

    // If we have data, return it
    if (existingData.length > 0) {
      const data = await db.priceHistory.findMany({
        where: {
          symbol: { in: dbSymbols },
          timestamp: {
            gte: twoYearsAgo,
          },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      return apiSuccess({
        symbol: rawSymbol,
        data: data.map((d) => ({
          timestamp: d.timestamp.getTime(),
          price: d.price,
          volume: d.volume || null,
          high: d.high || null,
          low: d.low || null,
          open: d.open || null,
          close: d.close || null,
        })),
      });
    }

    // Fetch from CoinGecko API
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      {
        headers: {
          "User-Agent": "TRADX/1.0",
        },
      }
    );

    if (!response.ok) {
      return apiSuccess({
        symbol: rawSymbol,
        data: generateFallbackHistoricalData(rawSymbol, days),
        degraded: true,
      });
    }

    const coinGeckoData: CoinGeckoHistoricalData = await response.json();

    // Transform and store in database
    const priceHistoryData = coinGeckoData.prices.map(([timestamp, price]) => ({
      symbol: `${compactSymbol}/USD`,
      assetType: "crypto",
      price,
      timestamp: new Date(timestamp),
      volume: null,
      high: null,
      low: null,
      open: null,
      close: null,
    }));

    // Batch insert (in chunks to avoid hitting limits)
    const batchSize = 100;
    for (let i = 0; i < priceHistoryData.length; i += batchSize) {
      const batch = priceHistoryData.slice(i, i + batchSize);
      await db.priceHistory.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    return apiSuccess({
      symbol: rawSymbol,
      data: priceHistoryData.map((d) => ({
        timestamp: d.timestamp.getTime(),
        price: d.price,
        volume: d.volume,
        high: d.high,
        low: d.low,
        open: d.open,
        close: d.close,
      })),
    });
  } catch (error) {
    console.warn("[market/historical] Falling back after historical API error:", error);
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTC";
    const days = parseInt(searchParams.get("days") || "730", 10);
    return apiSuccess({
      symbol: rawSymbol,
      data: generateFallbackHistoricalData(rawSymbol, days),
      degraded: true,
    });
  }
}

function generateFallbackHistoricalData(rawSymbol: string, days: number) {
  const compactSymbol = rawSymbol.toUpperCase().replace("/USD", "");
  const slug = toAssetSlug(compactSymbol);
  const fallback = getFallbackQuotes().find((quote) => toAssetSlug(quote.symbol) === slug);
  const basePrice = fallback?.price ?? 100;
  const totalDays = Math.max(1, Math.min(days, 730));
  const now = Date.now();
  let price = basePrice;

  return Array.from({ length: totalDays }, (_, index) => {
    const dayOffset = totalDays - index - 1;
    const drift = (Math.sin(index / 11) + Math.cos(index / 17)) * basePrice * 0.006;
    const open = price;
    const close = Math.max(basePrice * 0.1, open + drift);
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    price = close;

    return {
      timestamp: now - dayOffset * 24 * 60 * 60 * 1000,
      price: close,
      volume: null,
      high,
      low,
      open,
      close,
    };
  });
}

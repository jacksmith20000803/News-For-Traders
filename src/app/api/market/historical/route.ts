import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";

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
      const { apiError } = await import("@/lib/api/response");
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
      return apiError("Failed to fetch historical data from external API", 502);
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
    return handleApiError(error);
  }
}

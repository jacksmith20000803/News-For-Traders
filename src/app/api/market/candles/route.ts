import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { getCandles, type MarketInterval } from "@/lib/market/stream";
import { getFallbackQuotes } from "@/lib/fallback-data";
import { toAssetSlug } from "@/lib/assets/symbols";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "BTC/USD";
  const assetType = searchParams.get("assetType") ?? "crypto";
  const interval = (searchParams.get("interval") ?? "1H") as MarketInterval;
  const limit = clampNumber(Number(searchParams.get("limit") ?? 200), 50, 1000);
  const beforeParam = Number(searchParams.get("before"));
  const before = Number.isFinite(beforeParam) && beforeParam > 0 ? beforeParam : undefined;

  try {
    const candles = await getCandles(symbol, assetType, interval, limit, before);
    return apiSuccess({ candles, symbol, assetType, interval });
  } catch (error) {
    console.warn("[market/candles] Falling back after candle API error:", error);
    return apiSuccess({
      candles: generateFallbackCandles(symbol, interval, limit, before),
      symbol,
      assetType,
      interval,
      degraded: true,
    });
  }
}

function generateFallbackCandles(symbol: string, interval: MarketInterval, limit = 200, before?: number) {
  const slug = toAssetSlug(symbol);
  const fallback = getFallbackQuotes().find((quote) => toAssetSlug(quote.symbol) === slug);
  const basePrice = fallback?.price ?? 100;
  const intervalSeconds: Record<MarketInterval, number> = {
    "1s": 1,
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1H": 3600,
    "4H": 14400,
    "1D": 86400,
    "1W": 604800,
  };
  const bucketSeconds = intervalSeconds[interval] ?? 3600;
  const end = before ?? Math.floor(Date.now() / 1000);
  const now = Math.floor(end / bucketSeconds) * bucketSeconds;
  let price = basePrice;

  return Array.from({ length: limit }, (_, index) => {
    const time = now - (limit - index - 1) * bucketSeconds;
    const drift = (Math.sin(index / 7) + Math.cos(index / 13)) * basePrice * 0.002;
    const open = price;
    const close = Math.max(basePrice * 0.1, open + drift);
    const high = Math.max(open, close) * 1.002;
    const low = Math.min(open, close) * 0.998;
    price = close;
    return { time, open, high, low, close };
  });
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

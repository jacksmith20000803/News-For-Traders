import { db } from "@/lib/db";
import { toAssetSlug } from "@/lib/assets/symbols";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { eventBus } from "@/lib/events/broadcaster";
import { getFallbackQuotes } from "@/lib/fallback-data";

export type MarketInterval = "1s" | "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W" | "1Y";

export interface MarketTick {
  symbol: string;
  assetType: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  updatedAt: string;
}

/** Broadcast market update to all SSE clients */
export function broadcastMarketTick(tick: MarketTick) {
  eventBus.publish("market", tick);
}

/** Fetch latest quotes and broadcast — called from cron/sync */
export async function syncAndBroadcastMarket(): Promise<number> {
  let quotes: Array<{
    symbol: string;
    assetType: string;
    price: number;
    change: number | null;
    changePercent: number | null;
    updatedAt: Date | string;
  }>;

  try {
    quotes = await db.marketQuote.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    quotes = getFallbackQuotes();
  }

  for (const q of quotes) {
    broadcastMarketTick({
      symbol: q.symbol,
      assetType: q.assetType,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      updatedAt: q.updatedAt instanceof Date ? q.updatedAt.toISOString() : q.updatedAt,
    });
  }
  return quotes.length;
}

/** Generate synthetic OHLCV candles when no real data exists */
function generateSyntheticCandles(
  symbol: string,
  interval: MarketInterval,
  limit = 200,
  seedPrice?: number,
  endUnixSeconds?: number
): Array<{ time: number; open: number; high: number; low: number; close: number }> {
  const basePrices: Record<string, number> = {
    "BTC/USD": 95000,
    "ETH/USD": 3500,
    "EUR/USD": 1.08,
    "XAU/USD": 2650,
    "AAPL": 220,
    "NVDA": 130,
    "SPY": 580,
    "QQQ": 500,
  };

  const basePrice = seedPrice || basePrices[symbol] || 100;
  const msMap: Record<MarketInterval, number> = {
    "1s": 1000,
    "1m": 60000,
    "5m": 300000,
    "15m": 900000,
    "1H": 3600000,
    "4H": 14400000,
    "1D": 86400000,
    "1W": 604800000,
    "1Y": 31536000000,
  };

  const bucketMs = msMap[interval];
  const now = endUnixSeconds ?? Math.floor(Date.now() / 1000);
  const candles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  let currentPrice = basePrice;

  for (let i = limit - 1; i >= 0; i--) {
    const time = now - (i * bucketMs / 1000);
    const volatility = basePrice * 0.02;
    const change = (Math.random() - 0.48) * volatility;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.push({ time, open, high, low, close });
    currentPrice = close;
  }

  return candles;
}

/** Generate OHLCV candles from price history for chart intervals */
export async function getCandles(
  symbol: string,
  assetType: string,
  interval: MarketInterval,
  limit = 200,
  beforeUnixSeconds?: number
) {
  try {
    const historyRows = await db.priceHistory.findMany({
      where: {
        symbol,
        assetType,
        ...(beforeUnixSeconds
          ? { timestamp: { lt: new Date(beforeUnixSeconds * 1000) } }
          : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit * 4,
    });
    const history = historyRows.reverse();

    if (history.length === 0) {
      const quote = await db.marketQuote.findFirst({ where: { symbol, assetType } });
      return generateSyntheticCandles(
        symbol,
        interval,
        limit,
        quote?.price ?? getFallbackPrice(symbol),
        beforeUnixSeconds
      );
    }

    const msMap: Record<MarketInterval, number> = {
      "1s": 1000,
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1H": 3600000,
      "4H": 14400000,
      "1D": 86400000,
      "1W": 604800000,
      "1Y": 31536000000,
    };

    const bucketMs = msMap[interval];
    const buckets = new Map<number, { open: number; high: number; low: number; close: number }>();

    for (const h of history) {
      const ts = Math.floor(h.timestamp.getTime() / bucketMs) * bucketMs;
      const existing = buckets.get(ts);
      if (!existing) {
        buckets.set(ts, { open: h.price, high: h.price, low: h.price, close: h.price });
      } else {
        existing.high = Math.max(existing.high, h.price);
        existing.low = Math.min(existing.low, h.price);
        existing.close = h.price;
      }
    }

    const candles = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .slice(-limit)
      .map(([ts, c]) => ({
        time: Math.floor(ts / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    // If we have very few candles, supplement with synthetic data
    if (candles.length < 10) {
      const quote = await db.marketQuote.findFirst({ where: { symbol, assetType } });
      return generateSyntheticCandles(
        symbol,
        interval,
        limit,
        quote?.price ?? getFallbackPrice(symbol),
        beforeUnixSeconds
      );
    }

    return candles;
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    return generateSyntheticCandles(symbol, interval, limit, getFallbackPrice(symbol), beforeUnixSeconds);
  }
}

function getFallbackPrice(symbol: string) {
  const slug = toAssetSlug(symbol);
  return getFallbackQuotes().find((quote) => toAssetSlug(quote.symbol) === slug)?.price;
}

export function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function computeEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (ema === null) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

export function computeRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

export function computeMACD(closes: number[]) {
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macd = ema12.map((v, i) => (v != null && ema26[i] != null ? v - ema26[i]! : null));
  const signal = computeEMA(
    macd.filter((v): v is number => v != null),
    9
  );
  return { macd, signal };
}

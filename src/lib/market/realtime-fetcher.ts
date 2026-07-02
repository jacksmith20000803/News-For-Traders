import { db } from "@/lib/db";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { getFallbackQuotes } from "@/lib/fallback-data";
import { broadcastMarketTick } from "./stream";

interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
}

interface MarketQuotePayload {
  symbol: string;
  assetType: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  providerName: string;
}

const COINGECKO_IDS: Record<string, string> = {
  "BTC": "bitcoin",
  "ETH": "ethereum",
  "SOL": "solana",
  "XRP": "ripple",
  "ADA": "cardano",
  "DOGE": "dogecoin",
  "DOT": "polkadot",
  "BNB": "binancecoin",
  "AVAX": "avalanche-2",
  "LINK": "chainlink",
  "UNI": "uniswap",
  "ATOM": "cosmos",
  "LTC": "litecoin",
  "ETC": "ethereum-classic",
};

const CONNECTIVITY_WARNING_INTERVAL_MS = 60_000;
const marketQuoteMemory = new Map<string, number>();
let lastCoinGeckoWarningAt = 0;
let lastDatabaseWarningAt = 0;

/**
 * Fetch real-time crypto prices from CoinGecko API (free, no API key required)
 */
export async function fetchCryptoPrices(): Promise<CryptoPrice[]> {
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`,
      {
        headers: {
          'User-Agent': 'TRADX/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      warnCoinGeckoOnce(`CoinGecko returned ${response.status}; serving local fallback quotes.`);
      return [];
    }

    const data = await response.json();
    
    const prices: CryptoPrice[] = data.map((coin: CoinGeckoCoin) => {
      const symbol = Object.keys(COINGECKO_IDS).find(
        key => COINGECKO_IDS[key] === coin.id
      ) || coin.symbol.toUpperCase();
      
      return {
        symbol: `${symbol}/USD`,
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_24h || 0,
        changePercent24h: coin.price_change_percentage_24h || 0,
      };
    });

    return prices;
  } catch (error) {
    warnCoinGeckoOnce("CoinGecko request failed; serving local fallback quotes.", error);
    return [];
  }
}

/**
 * Update market quotes in database and broadcast updates
 */
export async function updateMarketQuotes() {
  try {
    const prices = await fetchCryptoPrices();
    const quotes = prices.length > 0 ? normalizeCryptoPrices(prices) : buildSyntheticFallbackQuotes();
    const validQuotes: MarketQuotePayload[] = [];
    let broadcasted = 0;
    let persisted = 0;

    for (const quote of quotes) {
      if (!isValidPrice(quote.price)) continue;

      broadcastMarketQuote(quote);
      rememberMarketQuote(quote);
      validQuotes.push(quote);
      broadcasted++;
    }

    for (const quote of validQuotes) {
      try {
        await persistMarketQuote(quote);
        persisted++;
      } catch (error) {
        if (isDatabaseConnectivityError(error)) {
          warnDatabaseOnce(
            "Market database is temporarily unreachable; live quote broadcasts are continuing without persistence.",
            error
          );
          break;
        }

        console.warn(`[market] Could not persist ${quote.symbol}; continuing broadcasts.`, error);
      }
    }
    
    return broadcasted > 0
      ? { success: true, updated: broadcasted, persisted, degraded: persisted < broadcasted }
      : { success: false, error: "No prices fetched" };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      warnDatabaseOnce("Market quote refresh skipped persistence because the database is unreachable.", error);
    } else {
      console.error("Error updating market quotes:", error);
    }
    return { success: false, error: String(error) };
  }
}

function normalizeCryptoPrices(prices: CryptoPrice[]): MarketQuotePayload[] {
  const cryptoQuotes = prices.map((price) => ({
    symbol: price.symbol,
    assetType: "crypto",
    name: price.name,
    price: price.price,
    change: price.change24h,
    changePercent: price.changePercent24h,
    providerName: "coingecko",
  }));

  const forexFallbacks = buildSyntheticFallbackQuotes().filter((quote) => quote.assetType === "forex");
  return [...cryptoQuotes, ...forexFallbacks];
}

function buildSyntheticFallbackQuotes(): MarketQuotePayload[] {
  return getFallbackQuotes().map((quote) => {
    const key = quoteKey(quote.symbol, quote.assetType);
    const previous = marketQuoteMemory.get(key) ?? quote.price;
    const volatility = quote.assetType === "forex" ? quote.price * 0.00035 : quote.price * 0.0015;
    const drift = (Math.random() - 0.48) * volatility;
    const price = Math.max(quote.price * 0.05, previous + drift);
    const change = price - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    return {
      symbol: quote.symbol,
      assetType: quote.assetType,
      name: quote.name,
      price,
      change,
      changePercent,
      providerName: "fallback",
    };
  });
}

async function persistMarketQuote(quote: MarketQuotePayload) {
  await db.marketQuote.upsert({
    where: { symbol_assetType: { symbol: quote.symbol, assetType: quote.assetType } },
    create: {
      symbol: quote.symbol,
      assetType: quote.assetType,
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      providerName: quote.providerName,
    },
    update: {
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      providerName: quote.providerName,
    },
  });

  await db.priceHistory.create({
    data: {
      symbol: quote.symbol,
      assetType: quote.assetType,
      price: quote.price,
      timestamp: new Date(),
    },
  });
}

function broadcastMarketQuote(quote: MarketQuotePayload) {
  broadcastMarketTick({
    symbol: quote.symbol,
    assetType: quote.assetType,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    updatedAt: new Date().toISOString(),
  });
}

function rememberMarketQuote(quote: MarketQuotePayload) {
  marketQuoteMemory.set(quoteKey(quote.symbol, quote.assetType), quote.price);
}

function quoteKey(symbol: string, assetType: string) {
  return `${symbol.toUpperCase()}:${assetType.toLowerCase()}`;
}

function isValidPrice(price: number) {
  return price != null && Number.isFinite(price) && price > 0;
}

function warnCoinGeckoOnce(message: string, error?: unknown) {
  const now = Date.now();
  if (now - lastCoinGeckoWarningAt < CONNECTIVITY_WARNING_INTERVAL_MS) return;
  lastCoinGeckoWarningAt = now;
  if (error) {
    console.warn(`[market] ${message}`, compactError(error));
    return;
  }
  console.warn(`[market] ${message}`);
}

function warnDatabaseOnce(message: string, error?: unknown) {
  const now = Date.now();
  if (now - lastDatabaseWarningAt < CONNECTIVITY_WARNING_INTERVAL_MS) return;
  lastDatabaseWarningAt = now;
  if (error) {
    console.warn(`[market] ${message}`, compactError(error));
    return;
  }
  console.warn(`[market] ${message}`);
}

function compactError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (error && typeof error === "object" && "code" in error) {
    return { code: String((error as { code?: unknown }).code) };
  }

  return String(error);
}

let pendingMarketRefresh: Promise<unknown> | null = null;
let lastMarketRefreshStartedAt = 0;

export function queueMarketQuoteRefresh(minIntervalMs = 1000) {
  const now = Date.now();
  if (pendingMarketRefresh || now - lastMarketRefreshStartedAt < minIntervalMs) return;

  lastMarketRefreshStartedAt = now;
  pendingMarketRefresh = updateMarketQuotes()
    .catch((error) => {
      console.error("Background market quote refresh failed:", error);
    })
    .finally(() => {
      pendingMarketRefresh = null;
    });
}

/**
 * Start periodic market data updates
 * CoinGecko free tier has rate limits, so use longer intervals
 */
export function startMarketUpdates(intervalMs = 60000) {
  const interval = setInterval(async () => {
    await updateMarketQuotes();
  }, intervalMs);
  
  return () => clearInterval(interval);
}

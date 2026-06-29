import { db } from "@/lib/db";
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

const FOREX_FALLBACK_QUOTES = [
  { symbol: "EUR/USD", assetType: "forex", name: "Euro / US Dollar", basePrice: 1.08 },
];

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
      }
    );

    if (!response.ok) {
      console.error("CoinGecko API error:", response.status);
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
    console.error("Error fetching crypto prices:", error);
    return [];
  }
}

/**
 * Update market quotes in database and broadcast updates
 */
export async function updateMarketQuotes() {
  try {
    const prices = await fetchCryptoPrices();
    let updated = 0;

    if (prices.length === 0) {
      console.warn("No crypto prices fetched; continuing with available fallback quotes.");
    }

    for (const priceData of prices) {
      try {
        // Skip if price is null or invalid
        if (priceData.price == null || isNaN(priceData.price) || priceData.price <= 0) {
          continue;
        }

        // Try to find existing record first
        const existing = await db.marketQuote.findFirst({
          where: {
            symbol: priceData.symbol,
            assetType: "crypto",
          },
        });
        
        if (existing) {
          // Update existing
          await db.marketQuote.update({
            where: { id: existing.id },
            data: {
              name: priceData.name,
              price: priceData.price,
              change: priceData.change24h,
              changePercent: priceData.changePercent24h,
            },
          });
        } else {
          // Create new
          await db.marketQuote.create({
            data: {
              symbol: priceData.symbol,
              assetType: "crypto",
              name: priceData.name,
              price: priceData.price,
              change: priceData.change24h,
              changePercent: priceData.changePercent24h,
              providerName: "coingecko",
            },
          });
        }
        
        // Add to price history
        await db.priceHistory.create({
          data: {
            symbol: priceData.symbol,
            assetType: "crypto",
            price: priceData.price,
            timestamp: new Date(),
          },
        });
        
        // Broadcast to SSE clients
        broadcastMarketTick({
          symbol: priceData.symbol,
          assetType: "crypto",
          price: priceData.price,
          change: priceData.change24h,
          changePercent: priceData.changePercent24h,
          updatedAt: new Date().toISOString(),
        });
        
        updated++;
      } catch (error) {
        console.error(`Error updating ${priceData.symbol}:`, error);
      }
    }

    for (const fallback of FOREX_FALLBACK_QUOTES) {
      try {
        const existing = await db.marketQuote.findFirst({
          where: { symbol: fallback.symbol, assetType: fallback.assetType },
        });
        const previousPrice = existing?.price ?? fallback.basePrice;
        const drift = (Math.random() - 0.5) * fallback.basePrice * 0.001;
        const price = Math.max(0.0001, previousPrice + drift);
        const change = price - previousPrice;
        const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

        await db.marketQuote.upsert({
          where: { symbol_assetType: { symbol: fallback.symbol, assetType: fallback.assetType } },
          create: {
            symbol: fallback.symbol,
            assetType: fallback.assetType,
            name: fallback.name,
            price,
            change,
            changePercent,
            providerName: "fallback",
          },
          update: {
            name: fallback.name,
            price,
            change,
            changePercent,
            providerName: "fallback",
          },
        });

        broadcastMarketTick({
          symbol: fallback.symbol,
          assetType: fallback.assetType,
          price,
          change,
          changePercent,
          updatedAt: new Date().toISOString(),
        });

        updated++;
      } catch (error) {
        console.error(`Error updating ${fallback.symbol}:`, error);
      }
    }
    
    return updated > 0
      ? { success: true, updated }
      : { success: false, error: "No prices fetched" };
  } catch (error) {
    console.error("Error updating market quotes:", error);
    return { success: false, error: String(error) };
  }
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

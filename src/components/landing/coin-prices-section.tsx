"use client";

import { memo, useCallback, useEffect, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { readJsonResponse } from "@/lib/api/client";

interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

interface CoinCardMeta {
  symbol: string;
  name: string;
  slug?: string;
  background?: string | null;
}

interface MarketQuote {
  symbol: string;
  name?: string | null;
  price: number;
  change?: number | null;
  changePercent?: number | null;
  assetType: string;
}

const FEATURED_COIN_META: CoinCardMeta[] = [
  { symbol: "ADA", name: "Cardano" },
  { symbol: "ATOM", name: "Cosmos" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "EUR", name: "Euro / US Dollar", slug: "EURUSD", background: null },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "LTC", name: "Litecoin" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "XRP", name: "XRP" },
];
const FEATURED_SYMBOLS = new Set(FEATURED_COIN_META.map((coin) => coin.symbol));
const coinStore = new Map<string, CoinPrice>();
const coinListeners = new Map<string, Set<() => void>>();

function getCoinSnapshot(symbol: string, fallback: CoinPrice) {
  return coinStore.get(symbol) ?? fallback;
}

function subscribeCoin(symbol: string, listener: () => void) {
  const listeners = coinListeners.get(symbol) ?? new Set<() => void>();
  listeners.add(listener);
  coinListeners.set(symbol, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) coinListeners.delete(symbol);
  };
}

function publishCoinUpdates(coins: CoinPrice[]) {
  for (const coin of coins) {
    const previous = coinStore.get(coin.symbol);
    const changed =
      !previous ||
      previous.name !== coin.name ||
      previous.price !== coin.price ||
      previous.change24h !== coin.change24h ||
      previous.changePercent24h !== coin.changePercent24h;

    if (!changed) continue;
    coinStore.set(coin.symbol, coin);
    coinListeners.get(coin.symbol)?.forEach((listener) => listener());
  }
}

function formatPrice(price: number) {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function toCoinPrice(quote: MarketQuote, previous?: CoinPrice): CoinPrice {
  const symbol = quote.symbol.replace("/USD", "");
  return {
    symbol,
    name: quote.name || previous?.name || symbol,
    price: quote.price,
    change24h: quote.change ?? previous?.change24h ?? 0,
    changePercent24h: quote.changePercent ?? previous?.changePercent24h ?? 0,
  };
}

function isFeaturedQuote(quote: MarketQuote) {
  return FEATURED_SYMBOLS.has(quote.symbol.replace("/USD", "").toUpperCase());
}

function useCoinValue(symbol: string, fallback: CoinPrice) {
  return useSyncExternalStore(
    (listener) => subscribeCoin(symbol, listener),
    () => getCoinSnapshot(symbol, fallback),
    () => fallback
  );
}

const CoinLiveChangeBadge = memo(function CoinLiveChangeBadge({
  symbol,
  fallback,
}: {
  symbol: string;
  fallback: CoinPrice;
}) {
  const coin = useCoinValue(symbol, fallback);
  const positive = coin.changePercent24h >= 0;

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 backdrop-blur-sm ${
        positive ? "bg-emerald-400/18 text-emerald-200" : "bg-red-400/18 text-red-200"
      }`}
      suppressHydrationWarning
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" suppressHydrationWarning />
      ) : (
        <TrendingDown className="h-3 w-3" suppressHydrationWarning />
      )}
      <span className="text-xs font-bold tabular-nums" suppressHydrationWarning>
        {positive ? "+" : ""}
        {coin.changePercent24h.toFixed(2)}%
      </span>
    </div>
  );
});

const CoinLivePriceValues = memo(function CoinLivePriceValues({
  symbol,
  fallback,
}: {
  symbol: string;
  fallback: CoinPrice;
}) {
  const coin = useCoinValue(symbol, fallback);
  const hasLivePrice = coin.price > 0;

  return (
    <div className="mt-8" suppressHydrationWarning>
      <p className="font-mono text-3xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] tabular-nums" suppressHydrationWarning>
        <span>{hasLivePrice ? formatPrice(coin.price) : "Loading..."}</span>
      </p>
      <p className={`mt-1 text-sm font-semibold drop-shadow-md ${coin.change24h >= 0 ? "text-emerald-200" : "text-red-200"}`} suppressHydrationWarning>
        <span>
          {hasLivePrice
            ? `${coin.change24h >= 0 ? "+" : ""}${formatPrice(coin.change24h)} (24h)`
            : "Waiting for live tick"}
        </span>
      </p>
    </div>
  );
});

const CoinPriceCard = memo(function CoinPriceCard({
  coin,
  index,
}: {
  coin: CoinCardMeta;
  index: number;
}) {
  const fallback = coinStore.get(coin.symbol) ?? {
    symbol: coin.symbol,
    name: coin.name,
    price: 0,
    change24h: 0,
    changePercent24h: 0,
  };
  const backgroundImage = coin.background === null
    ? "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.45), transparent 34%), linear-gradient(135deg, #0f172a 0%, #0a0c0c 55%, #052e2b 100%)"
    : `url(/coin-backgrounds/${coin.background ?? `${coin.symbol.toLowerCase()}.jpg`})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group live-market-card rounded-2xl"
      suppressHydrationWarning
    >
      <div
        className="h-full min-h-[210px] rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-cyan-500/20 dark:border-white/10 dark:bg-[#0a0c0c] relative overflow-hidden"
        suppressHydrationWarning
        style={{
          backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/68 to-black/25" />
        <div className="absolute inset-0 bg-cyan-950/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3" suppressHydrationWarning>
            <div className="min-w-0" suppressHydrationWarning>
              <h3 className="text-xl font-bold text-white drop-shadow-lg" suppressHydrationWarning>{coin.symbol}</h3>
              <p className="text-xs font-medium text-cyan-50/85 drop-shadow-md line-clamp-1" suppressHydrationWarning>{coin.name}</p>
            </div>
            <CoinLiveChangeBadge symbol={coin.symbol} fallback={fallback} />
          </div>

          <CoinLivePriceValues symbol={coin.symbol} fallback={fallback} />

          <div className="mt-5" suppressHydrationWarning>
            <ButtonLink
              href={`/assets/${coin.slug ?? coin.symbol}`}
              className="w-full bg-white/12 text-xs font-bold text-cyan-50 shadow-lg backdrop-blur-md hover:bg-white/18"
            >
              View Details
            </ButtonLink>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export function CoinPricesSection() {
  const applyQuotes = useCallback((quotes: MarketQuote[]) => {
    const formattedCoins = quotes
      .filter(isFeaturedQuote)
      .map((quote) => {
        const symbol = quote.symbol.replace("/USD", "").toUpperCase();
        return toCoinPrice(quote, coinStore.get(symbol));
      });

    if (formattedCoins.length === 0) return;

    publishCoinUpdates(formattedCoins);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialSync = window.setTimeout(async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/market?sync=true", { cache: "no-store" });
        const json = await readJsonResponse<{
          success: boolean;
          data?: { quotes?: MarketQuote[] };
        }>(res);
        if (!cancelled && json.success && json.data?.quotes) {
          applyQuotes(json.data.quotes);
        }
      } catch {
        // The shared realtime sync/SSE feed remains the fallback.
      }
    }, 800);

    const unsubSync = subscribeRealtimeSync((payload) => {
      applyQuotes(payload.quotes.map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        change: 0,
        changePercent: quote.changePercent ?? 0,
        assetType: quote.assetType,
      })));
    });

    const unsubSse = subscribeSSE((event, data) => {
      if (event !== "market" || !data || typeof data !== "object") return;
      const tick = data as {
        symbol: string;
        assetType: string;
        price: number;
        change?: number | null;
        changePercent?: number | null;
      };
      applyQuotes([{
        symbol: tick.symbol,
        price: tick.price,
        change: tick.change ?? 0,
        changePercent: tick.changePercent ?? 0,
        assetType: tick.assetType,
      }]);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(initialSync);
      unsubSync();
      unsubSse();
    };
  }, [applyQuotes]);

  return (
    <section className="relative py-20 bg-gray-50 dark:bg-[#0a0c0c]" suppressHydrationWarning>
      <div className="absolute inset-0" suppressHydrationWarning>
        <div
          className="absolute inset-0"
          suppressHydrationWarning
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-12"
          suppressHydrationWarning
        >
          <div className="flex items-center justify-between mb-4" suppressHydrationWarning>
            <div className="flex items-center gap-3" suppressHydrationWarning>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10" suppressHydrationWarning>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Live Market Prices</h2>
            </div>
            <ButtonLink
              href="/charts"
              variant="outline"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              View All Markets
              <ArrowUpRight className="w-4 h-4" />
            </ButtonLink>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl">
            Real-time cryptocurrency prices and market data. Track your favorite coins without signing up.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" suppressHydrationWarning>
          {FEATURED_COIN_META.map((coin, index) => (
            <CoinPriceCard key={coin.symbol} coin={coin} index={index} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 text-center sm:hidden"
          suppressHydrationWarning
        >
          <div suppressHydrationWarning>
            <ButtonLink
              href="/charts"
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-900 dark:text-white border-gray-300 dark:border-white/10"
            >
              View All Markets
              <ArrowUpRight className="w-4 h-4" suppressHydrationWarning />
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

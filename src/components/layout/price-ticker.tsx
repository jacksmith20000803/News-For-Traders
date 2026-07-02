"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { useMounted } from "@/lib/hooks/use-mounted";

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function PriceTicker() {
  const mounted = useMounted();
  const initialTickers = useMemo<TickerItem[]>(() => [
    { symbol: "ADA/USD", price: 0.45, change: 0, changePercent: 0 },
    { symbol: "ATOM/USD", price: 6.2, change: 0, changePercent: 0 },
    { symbol: "AVAX/USD", price: 28, change: 0, changePercent: 0 },
    { symbol: "BNB/USD", price: 620, change: 0, changePercent: 0 },
    { symbol: "BTC/USD", price: 95000, change: 0, changePercent: 0 },
    { symbol: "DOGE/USD", price: 0.12, change: 0, changePercent: 0 },
    { symbol: "DOT/USD", price: 4.8, change: 0, changePercent: 0 },
    { symbol: "ETH/USD", price: 3500, change: 0, changePercent: 0 },
    { symbol: "EUR/USD", price: 1.08, change: 0, changePercent: 0 },
    { symbol: "LINK/USD", price: 14, change: 0, changePercent: 0 },
    { symbol: "LTC/USD", price: 85, change: 0, changePercent: 0 },
    { symbol: "SOL/USD", price: 145, change: 0, changePercent: 0 },
    { symbol: "UNI/USD", price: 9.5, change: 0, changePercent: 0 },
    { symbol: "XRP/USD", price: 0.52, change: 0, changePercent: 0 },
  ], []);
  const [tickers, setTickers] = useState<TickerItem[]>(initialTickers);

  useEffect(() => {
    return subscribeRealtimeSync((payload) => {
      const quotesBySymbol = new Map(
        payload.quotes.map((quote) => [quote.symbol, quote])
      );

      setTickers((prev) => {
        let changed = false;

        const next = prev.map((item) => {
          const quote = quotesBySymbol.get(item.symbol);
          if (!quote) return item;

          const nextItem = {
            ...item,
            price: quote.price,
            change: quote.change ?? item.change,
            changePercent: quote.changePercent ?? 0,
          };

          const itemChanged =
            nextItem.price !== item.price ||
            nextItem.change !== item.change ||
            nextItem.changePercent !== item.changePercent;

          if (itemChanged) {
            changed = true;
          }

          return itemChanged ? nextItem : item;
        });

        return changed ? next : prev;
      });
    });
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-9 w-full border-b border-gray-300 bg-gray-100 dark:border-white/5 dark:bg-[#0a0c0c]"
        suppressHydrationWarning
      />
    );
  }

  return (
    <div className="w-full border-b border-gray-300 bg-gray-100 overflow-hidden relative dark:border-white/5 dark:bg-[#0a0c0c]" suppressHydrationWarning>
      {/* Slow-scrolling animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="ticker-sweep absolute inset-0" />
        <style jsx>{`
          .ticker-sweep {
            background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.05) 50%, transparent 100%);
            animation: slowScroll 20s linear infinite;
            transform: translateX(-100%);
          }
          :global(.dark) .ticker-sweep {
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%);
          }
          @keyframes slowScroll {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>

      {/* 10-second glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="ticker-glow absolute inset-0" />
        <style jsx>{`
          .ticker-glow {
            background: radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 50%);
            animation: glowPulse 10s ease-in-out infinite;
            opacity: 0;
          }
          :global(.dark) .ticker-glow {
            background: radial-gradient(circle at 50% 50%, rgba(34,211,238,0.1) 0%, transparent 50%);
          }
          @keyframes glowPulse {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
      
      <div className="flex items-center gap-6 py-2 px-4 relative z-10 animate-marquee" suppressHydrationWarning>
        <style jsx>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 60s linear infinite;
          }
        `}</style>
        {[...tickers, ...tickers].map((ticker, index) => (
          <div
            key={`${ticker.symbol}-${index}`}
            className="flex items-center gap-2 shrink-0 whitespace-nowrap"
            suppressHydrationWarning
          >
            <span className="text-xs font-semibold text-gray-900 dark:text-white/90">{ticker.symbol}</span>
            <span className="text-xs font-mono text-blue-600 dark:text-cyan-400">
              ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium",
              ticker.changePercent >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            )} suppressHydrationWarning>
              {ticker.changePercent >= 0 ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {ticker.changePercent >= 0 ? "+" : ""}{ticker.changePercent.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";

interface MarketItem {
  name: string;
  symbol: string;
  value: string;
  change: string;
  changePositive: boolean;
  direction?: "up" | "down" | null;
}

function Sparkline({ positive }: { positive: boolean }) {
  const color = positive ? "text-cyan-400" : "text-red-500";
  return (
    <svg
      className={cn("h-6 w-16 sm:h-8 sm:w-20", color)}
      viewBox="0 0 80 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d={positive
          ? "M0 24 L10 20 L20 22 L30 16 L40 18 L50 12 L60 14 L70 8 L80 10"
          : "M0 8 L10 12 L20 10 L30 16 L40 14 L50 20 L60 18 L70 24 L80 22"
        }
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketOverview() {
  const [marketItems, setMarketItems] = useState<MarketItem[]>([
    { name: "S&P 500", symbol: "SPY", value: "5,234.56", change: "+1.2%", changePositive: true },
    { name: "NASDAQ", symbol: "QQQ", value: "16,456.78", change: "+0.8%", changePositive: true },
    { name: "BTC/USD", symbol: "BTC/USD", value: "67,234.00", change: "+2.4%", changePositive: true },
    { name: "ETH/USD", symbol: "ETH/USD", value: "3,456.78", change: "-0.5%", changePositive: false },
    { name: "GOLD", symbol: "XAU/USD", value: "2,345.60", change: "+0.3%", changePositive: true },
    { name: "DOW", symbol: "DIA", value: "39,123.45", change: "+0.6%", changePositive: true },
  ]);

  useEffect(() => {
    const applyQuote = (tick: { symbol: string; price: number; changePercent?: number | null }) => {
      setMarketItems(prev => prev.map(item => {
        if (item.symbol === tick.symbol) {
          const prevValue = parseFloat(item.value.replace(/,/g, ''));
          const direction: "up" | "down" | null = tick.price > prevValue ? "up" : tick.price < prevValue ? "down" : null;
          const changePercent = tick.changePercent;
          
          const updated: MarketItem = {
            ...item,
            value: tick.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: changePercent != null
              ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
              : item.change,
            changePositive: changePercent != null ? changePercent >= 0 : item.changePositive,
            direction,
          };
          
          // Clear direction after animation
          if (direction) {
            setTimeout(() => {
              setMarketItems(items => items.map(i => i.symbol === item.symbol ? { ...i, direction: null } : i));
            }, 200);
          }
          
          return updated;
        }
        return item;
      }));
    };

    const unsub = subscribeSSE((channel, data) => {
      if (channel !== "market") return;
      const tick = data as { symbol: string; price: number; changePercent?: number };
      applyQuote(tick);
    });

    const unsubSync = subscribeRealtimeSync((payload) => {
      payload.quotes.forEach((quote) => applyQuote(quote));
    });

    return () => {
      unsub();
      unsubSync();
    };
  }, []);

  return (
    <div className="dash-panel p-4 sm:p-5" suppressHydrationWarning>
      <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 sm:mb-4 uppercase tracking-wider">
        Market Overview
      </h3>
      <div className="space-y-2 sm:space-y-3" suppressHydrationWarning>
        {marketItems.map((item) => (
          <div
            key={item.symbol}
            className={cn(
              "flex items-center justify-between py-2 border-b border-border last:border-0 transition-all",
              item.direction === "up" && "price-flash-up",
              item.direction === "down" && "price-flash-down"
            )}
            suppressHydrationWarning
          >
            <div className="flex-1 min-w-0" suppressHydrationWarning>
              <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums">{item.value}</p>
            </div>
            <Sparkline positive={item.changePositive} />
            <div className={cn(
              "text-xs sm:text-sm font-bold font-mono tabular-nums w-12 sm:w-16 text-right shrink-0",
              item.changePositive ? "text-cyan-400" : "text-red-500"
            )} suppressHydrationWarning>
              {item.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

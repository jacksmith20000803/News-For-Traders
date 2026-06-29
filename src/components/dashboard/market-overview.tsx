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
    { name: "NASDAQ 100", symbol: "QQQ", value: "16,456.78", change: "+0.8%", changePositive: true },
    { name: "BTC/USD", symbol: "BTC/USD", value: "67,234.00", change: "+2.4%", changePositive: true },
    { name: "ETH/USD", symbol: "ETH/USD", value: "3,456.78", change: "-0.5%", changePositive: false },
    { name: "GOLD", symbol: "XAU/USD", value: "2,345.60", change: "+0.3%", changePositive: true },
    { name: "DOW JONES", symbol: "DIA", value: "39,123.45", change: "+0.6%", changePositive: true },
  ]);
  const advancingCount = marketItems.filter((item) => item.changePositive).length;
  const riskTone = advancingCount >= 4 ? "Risk-on" : advancingCount >= 3 ? "Mixed" : "Defensive";

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
            }, 10);
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
    <div className="dash-panel flex h-full min-h-[330px] flex-col p-5 sm:p-6" suppressHydrationWarning>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Market Overview</h3>
        <a href="/charts" className="text-xs font-bold text-primary hover:underline">
          View All
        </a>
      </div>
      <div className="flex-1 space-y-2" suppressHydrationWarning>
        {marketItems.map((item) => (
          <div
            key={item.symbol}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-border/60 bg-background/45 px-3 py-3 transition-all hover:bg-muted/60"
            suppressHydrationWarning
          >
            <div className="flex-1 min-w-0" suppressHydrationWarning>
              <p className="truncate text-xs font-bold text-foreground">{item.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.symbol}</p>
            </div>
            <Sparkline positive={item.changePositive} />
            <div className="text-right" suppressHydrationWarning>
              <p
                className={cn(
                  "font-mono text-xs font-semibold tabular-nums text-foreground",
                  item.direction === "up" && "nudge-up text-success",
                  item.direction === "down" && "nudge-down text-error"
                )}
              >
                {item.value}
              </p>
              <p className={cn(
                "font-mono text-xs font-bold tabular-nums",
                item.changePositive ? "text-success" : "text-error"
              )}>
                {item.change}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/80 to-cyan-500/10 p-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tone</p>
          <p className="mt-1 text-sm font-extrabold text-foreground">{riskTone}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Advancing</p>
          <p className="mt-1 text-sm font-extrabold text-emerald-500">
            {advancingCount}/{marketItems.length} markets
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Monitor</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
            {marketItems.map((item) => (
              <span
                key={`bar-${item.symbol}`}
                className={cn("flex-1", item.changePositive ? "bg-emerald-400" : "bg-red-400")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

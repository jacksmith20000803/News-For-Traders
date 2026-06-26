"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function PriceTicker() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? (resolvedTheme ?? "dark") : (theme ?? "dark");
  const initialTickers = useMemo<TickerItem[]>(() => [
    { symbol: "BTC/USD", price: 67234.00, change: 234.50, changePercent: 0.35 },
    { symbol: "ETH/USD", price: 3456.78, change: -45.23, changePercent: -1.29 },
    { symbol: "SOL/USD", price: 145.67, change: 8.90, changePercent: 6.51 },
    { symbol: "XRP/USD", price: 0.5234, change: 0.0123, changePercent: 2.41 },
    { symbol: "ADA/USD", price: 0.4567, change: -0.0089, changePercent: -1.91 },
    { symbol: "DOGE/USD", price: 0.1234, change: 0.0056, changePercent: 4.76 },
  ], []);
  const [tickers, setTickers] = useState<TickerItem[]>(initialTickers);

  useEffect(() => {
    return subscribeRealtimeSync((payload) => {
      const quotesBySymbol = new Map(
        payload.quotes.map((quote) => [quote.symbol, quote])
      );

      setTickers((prev) => prev.map((item) => {
        const quote = quotesBySymbol.get(item.symbol);
        if (!quote) return item;
        return {
          ...item,
          price: quote.price,
          changePercent: quote.changePercent ?? 0,
        };
      }));
    });
  }, []);

  const bgColor = currentTheme === "dark" ? "bg-[#0a0c0c]" : "bg-gray-100";
  const borderColor = currentTheme === "dark" ? "border-white/5" : "border-gray-300";
  const textColor = currentTheme === "dark" ? "text-white/90" : "text-gray-900";
  const priceColor = currentTheme === "dark" ? "text-cyan-400" : "text-blue-600";
  const emeraldColor = currentTheme === "dark" ? "text-emerald-400" : "text-emerald-600";
  const redColor = currentTheme === "dark" ? "text-red-400" : "text-red-600";
  const sweepColor = currentTheme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";

  return (
    <div className={cn("w-full border-b overflow-hidden relative", bgColor, borderColor)} suppressHydrationWarning>
      {/* Slow-scrolling animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          background: `linear-gradient(90deg, transparent 0%, ${sweepColor} 50%, transparent 100%)`,
          animation: 'slowScroll 20s linear infinite',
          transform: 'translateX(-100%)',
        }} />
        <style jsx>{`
          @keyframes slowScroll {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>

      {/* 10-second glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          background: currentTheme === "dark" 
            ? 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 50%)',
          animation: 'glowPulse 10s ease-in-out infinite',
          opacity: 0,
        }} />
        <style jsx>{`
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
            <span className={cn("text-xs font-semibold", textColor)}>{ticker.symbol}</span>
            <span className={cn("text-xs font-mono", priceColor)}>
              ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium",
              ticker.changePercent >= 0 ? emeraldColor : redColor
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

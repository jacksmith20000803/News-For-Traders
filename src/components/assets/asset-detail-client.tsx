"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { subscribeSSE } from "@/components/realtime/sse-provider";

interface Quote {
  price: number;
  changePercent: number | null;
}

interface AssetDetailClientProps {
  symbol: string;
  initialQuote: Quote | null;
  initialPositive: boolean;
}

function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/\/USD$/, "");
}

export function AssetDetailClient({ symbol, initialQuote, initialPositive }: AssetDetailClientProps) {
  const [quote, setQuote] = useState<Quote | null>(initialQuote);
  const [positive, setPositive] = useState(initialPositive);

  const applyQuote = useCallback((nextQuote: Quote) => {
    setQuote((current) => {
      if (
        current &&
        current.price === nextQuote.price &&
        current.changePercent === nextQuote.changePercent
      ) {
        return current;
      }
      return nextQuote;
    });
    setPositive((nextQuote.changePercent ?? 0) >= 0);
  }, []);

  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.success && json.data?.quote) {
          applyQuote({
            price: json.data.quote.price,
            changePercent: json.data.quote.changePercent || null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch real-time data:", error);
      }
    };

    const initialTimer = window.setTimeout(fetchRealTimeData, initialQuote ? 2500 : 0);

    const normalizedSymbol = normalizeSymbol(symbol);
    const unsubSync = subscribeRealtimeSync((payload) => {
      const tick = payload.quotes.find((item) => normalizeSymbol(item.symbol) === normalizedSymbol);
      if (!tick) return;
      applyQuote({
        price: tick.price,
        changePercent: tick.changePercent,
      });
    });

    const unsubSse = subscribeSSE((event, data) => {
      if (event !== "market" || !data || typeof data !== "object") return;
      const tick = data as { symbol?: string; price?: number; changePercent?: number | null };
      if (!tick.symbol || typeof tick.price !== "number") return;
      if (normalizeSymbol(tick.symbol) !== normalizedSymbol) return;
      applyQuote({
        price: tick.price,
        changePercent: tick.changePercent ?? null,
      });
    });

    const interval = setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void fetchRealTimeData();
      }
    }, 15000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      unsubSync();
      unsubSse();
    };
  }, [applyQuote, initialQuote, symbol]);

  if (!quote) {
    return (
      <div className="text-right">
        <p className="text-3xl font-bold font-mono tabular-nums text-muted-foreground">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-3xl font-bold font-mono tabular-nums"
      >
        {quote.price.toFixed(quote.price < 10 ? 4 : 2)}
      </motion.p>
      <motion.p
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center justify-end gap-1 font-mono text-sm tabular-nums ${
          positive ? "text-accent" : "text-destructive"
        }`}
      >
        {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {quote.changePercent != null
          ? `${positive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
          : "—"}
      </motion.p>
    </div>
  );
}

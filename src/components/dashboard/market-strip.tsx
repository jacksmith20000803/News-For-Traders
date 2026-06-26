"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { useEffect, useState } from "react";

interface Quote {
  id?: string;
  symbol: string;
  price: number;
  changePercent: number | null;
  assetType: string;
}

interface MarketStripProps {
  initialQuotes: Quote[];
  configured: boolean;
}

function QuotePill({ quote }: { quote: Quote }) {
  const positive = (quote.changePercent ?? 0) >= 0;
  return (
    <div className="flex shrink-0 items-center gap-3 px-5 font-mono text-sm">
      <span className="font-semibold text-foreground">{quote.symbol}</span>
      <span className="text-muted-foreground tabular-nums">
        {quote.price > 0 ? quote.price.toFixed(quote.price < 10 ? 4 : 2) : "—"}
      </span>
      <span className={cn("flex items-center gap-1 tabular-nums font-medium", positive ? "text-accent" : "text-destructive")}>
        {quote.changePercent != null ? (
          <>
            {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {positive ? "+" : ""}{quote.changePercent.toFixed(2)}%
          </>
        ) : "—"}
      </span>
    </div>
  );
}

export function MarketStrip({ initialQuotes, configured }: MarketStripProps) {
  const [quotes, setQuotes] = useState(initialQuotes);

  useEffect(() => {
    const apply = (data: { quotes: Quote[] }) => {
      if (data.quotes?.length) {
        setQuotes(data.quotes.map((q, i) => ({ ...q, id: `q-${i}` })));
      }
    };

    const unsubSync = subscribeRealtimeSync(apply);
    const unsubSSE = subscribeSSE((event, data) => {
      if (event === "market" && data && typeof data === "object" && "symbol" in data) {
        const tick = data as { symbol: string; price: number; changePercent: number | null; assetType: string };
        setQuotes((prev) => {
          const idx = prev.findIndex((q) => q.symbol === tick.symbol);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], price: tick.price, changePercent: tick.changePercent };
            return next;
          }
          return prev;
        });
      }
    });

    return () => { unsubSync(); unsubSSE(); };
  }, []);

  if (!configured && quotes.length === 0) {
    return (
      <div className="ticker-wrap px-4 py-2.5">
        <p className="text-center text-sm text-muted-foreground">Connecting market data…</p>
      </div>
    );
  }

  const display = quotes.length > 0 ? quotes : initialQuotes;
  const track = [...display, ...display];

  return (
    <div className="ticker-wrap py-2.5">
      <div className="ticker-track">
        {track.map((q, i) => (
          <QuotePill key={`${q.symbol}-${i}`} quote={q} />
        ))}
      </div>
    </div>
  );
}

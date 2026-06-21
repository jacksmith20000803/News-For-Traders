"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { useEffect, useState } from "react";

interface Quote {
  id: string;
  symbol: string;
  price: number;
  changePercent: number | null;
  assetType: string;
}

const DEFAULT_SYMBOLS = [
  "DXY", "EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD",
  "WTI", "BTC/USD", "ETH/USD", "SPY", "QQQ",
];

interface MarketStripProps {
  initialQuotes: Quote[];
  configured: boolean;
}

function QuotePill({ quote }: { quote: Quote }) {
  const positive = (quote.changePercent ?? 0) >= 0;
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-4 font-mono text-xs">
      <span className="font-semibold text-foreground">{quote.symbol}</span>
      <span className="text-muted-foreground tabular-nums">
        {quote.price > 0 ? quote.price.toFixed(quote.price < 10 ? 4 : 2) : "—"}
      </span>
      <span
        className={cn(
          "flex items-center gap-0.5 tabular-nums font-medium",
          positive ? "text-accent" : "text-destructive"
        )}
      >
        {quote.changePercent != null ? (
          <>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? "+" : ""}{quote.changePercent.toFixed(2)}%
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}

export function MarketStrip({ initialQuotes, configured }: MarketStripProps) {
  const [quotes, setQuotes] = useState(initialQuotes);

  useEffect(() => {
    return subscribeSSE((event) => {
      if (event === "market") {
        fetch("/api/market")
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data.quotes?.length) {
              setQuotes(json.data.quotes);
            }
          })
          .catch(() => {});
      }
    });
  }, []);

  if (!configured && quotes.length === 0) {
    return (
      <div className="ticker-wrap px-4 py-2">
        <p className="text-center text-xs text-muted-foreground font-mono">
          Live data provider not configured.
        </p>
      </div>
    );
  }

  const displayQuotes =
    quotes.length > 0
      ? quotes
      : DEFAULT_SYMBOLS.map((symbol, i) => ({
          id: `placeholder-${symbol}`,
          symbol,
          price: 0,
          changePercent: null,
          assetType: "unknown",
        }));

  const track = [...displayQuotes, ...displayQuotes];

  return (
    <div className="ticker-wrap py-2">
      <div className="ticker-track">
        {track.map((q, i) => (
          <QuotePill key={`${q.id}-${i}`} quote={q} />
        ))}
      </div>
    </div>
  );
}

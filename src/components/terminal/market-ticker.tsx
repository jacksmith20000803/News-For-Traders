import { db } from "@/lib/db";
import { isAnyProviderConfigured } from "@/lib/providers/news";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export async function MarketTicker() {
  const configured = isAnyProviderConfigured();
  const quotes = await db.marketQuote.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const indices = quotes.filter((q) => q.assetType === "index");
  const forex = quotes.filter((q) => q.assetType === "forex");
  const crypto = quotes.filter((q) => q.assetType === "crypto");
  const commodities = quotes.filter((q) => q.assetType === "commodity");

  if (!configured && quotes.length === 0) {
    return (
      <div className="terminal-ticker border-b border-border bg-card/50 px-4 py-2">
        <p className="text-xs text-muted-foreground font-mono">
          Live data provider not configured.
        </p>
      </div>
    );
  }

  const sections = [
    { label: "Indices", items: indices },
    { label: "FX", items: forex },
    { label: "Crypto", items: crypto },
    { label: "Commodities", items: commodities },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <div className="terminal-ticker border-b border-border bg-card/50 px-4 py-2">
        <p className="text-xs text-muted-foreground font-mono">
          Market data loading — run ingestion to populate quotes.
        </p>
      </div>
    );
  }

  return (
    <div className="terminal-ticker border-b border-border bg-card/50 overflow-x-auto">
      <div className="flex gap-6 px-4 py-2 min-w-max">
        {sections.map((section) => (
          <div key={section.label} className="flex items-center gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </span>
            {section.items.map((q) => (
              <QuoteChip key={q.id} quote={q} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteChip({
  quote,
}: {
  quote: {
    symbol: string;
    price: number;
    changePercent: number | null;
  };
}) {
  const positive = (quote.changePercent ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="font-semibold text-foreground">{quote.symbol}</span>
      <span className="text-muted-foreground">{quote.price.toFixed(2)}</span>
      <span
        className={cn(
          "flex items-center gap-0.5",
          positive ? "text-accent" : "text-destructive"
        )}
      >
        {positive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {quote.changePercent != null
          ? `${positive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
          : "—"}
      </span>
    </div>
  );
}

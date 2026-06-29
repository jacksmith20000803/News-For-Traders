import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Mover {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePositive: boolean;
}

const movers: Mover[] = [
  { symbol: "NVDA", name: "NVIDIA", price: "$924.50", change: "+5.2%", changePositive: true },
  { symbol: "TSLA", name: "Tesla", price: "$178.30", change: "+3.8%", changePositive: true },
  { symbol: "AAPL", name: "Apple", price: "$189.45", change: "+1.2%", changePositive: true },
  { symbol: "META", name: "Meta", price: "$505.20", change: "-0.8%", changePositive: false },
  { symbol: "AMZN", name: "Amazon", price: "$178.25", change: "+2.1%", changePositive: true },
];

export function TopMovers() {
  return (
    <div className="dash-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Movers</h3>
        <div className="flex rounded-lg bg-muted p-1 text-[11px] font-bold text-muted-foreground">
          <span className="rounded-md bg-primary/15 px-2 py-1 text-primary">Gainers</span>
          <span className="px-2 py-1">Losers</span>
          <span className="px-2 py-1">Active</span>
        </div>
      </div>

      <div className="space-y-1">
        {movers.map((mover) => (
          <div
            key={mover.symbol}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-black",
              mover.changePositive ? "bg-success/12 text-success" : "bg-error/12 text-error"
            )}>
              {mover.changePositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{mover.symbol}</p>
              <p className="truncate text-xs text-muted-foreground">{mover.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-semibold">{mover.price}</p>
              <p className={cn(
                "font-mono text-xs font-bold",
                mover.changePositive ? "text-success" : "text-error"
              )}>
                {mover.change}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

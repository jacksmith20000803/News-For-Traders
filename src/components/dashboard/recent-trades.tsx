import { cn } from "@/lib/utils";

interface Trade {
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  time: string;
}

const trades: Trade[] = [
  { symbol: "AAPL", type: "BUY", quantity: 50, price: 189.45, time: "10:32 AM" },
  { symbol: "BTC/USD", type: "SELL", quantity: 0.1, price: 66245.30, time: "10:21 AM" },
  { symbol: "NVDA", type: "SELL", quantity: 25, price: 924.50, time: "10:15 AM" },
  { symbol: "TSLA", type: "BUY", quantity: 30, price: 178.30, time: "09:45 AM" },
  { symbol: "MSFT", type: "BUY", quantity: 20, price: 415.20, time: "09:30 AM" },
];

export function RecentTrades() {
  return (
    <div className="dash-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recent Trades</h3>
        <a href="/dashboard/portfolio" className="text-xs font-bold text-primary hover:underline">
          View All
        </a>
      </div>
      <div className="space-y-1">
        {trades.map((trade) => (
          <div
            key={`${trade.symbol}-${trade.time}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-black">
              {trade.symbol.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{trade.symbol}</p>
              <p className="text-xs text-muted-foreground">{trade.quantity} units</p>
            </div>
            <span className={cn(
              "rounded-md px-2 py-1 text-[10px] font-bold",
              trade.type === "BUY" ? "bg-success/15 text-success" : "bg-error/15 text-error"
            )}>
              {trade.type}
            </span>
            <div className="text-right">
              <p className="font-mono text-xs font-bold">${trade.price.toLocaleString()}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{trade.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

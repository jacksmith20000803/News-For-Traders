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
  { symbol: "NVDA", type: "SELL", quantity: 25, price: 924.50, time: "10:15 AM" },
  { symbol: "TSLA", type: "BUY", quantity: 30, price: 178.30, time: "09:45 AM" },
  { symbol: "MSFT", type: "BUY", quantity: 20, price: 415.20, time: "09:30 AM" },
];

export function RecentTrades() {
  return (
    <div className="dash-panel p-4 sm:p-5">
      <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 sm:mb-4 uppercase tracking-wider">
        Recent Trades
      </h3>
      <div className="space-y-2">
        {trades.map((trade) => (
          <div
            key={`${trade.symbol}-${trade.time}`}
            className="flex items-center justify-between py-2 px-2 sm:px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={cn(
                "text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-1 rounded",
                trade.type === "BUY" ? "bg-success/20 text-success" : "bg-error/20 text-error"
              )}>
                {trade.type}
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold truncate">{trade.symbol}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{trade.quantity} @ ${trade.price.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono shrink-0">{trade.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

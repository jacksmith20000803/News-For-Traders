"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { useState } from "react";

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
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <div className="dash-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Top Movers
        </h3>
        <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
      
      {viewMode === "list" ? (
        <div className="space-y-2">
          {movers.map((mover) => (
            <div
              key={mover.symbol}
              className="flex items-center justify-between py-2 px-2 sm:px-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg",
                  mover.changePositive ? "bg-success/10" : "bg-error/10"
                )}>
                  {mover.changePositive ? (
                    <TrendingUp className={cn("h-3 w-3 sm:h-4 sm:w-4 text-success")} />
                  ) : (
                    <TrendingDown className={cn("h-3 w-3 sm:h-4 sm:w-4 text-error")} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold truncate">{mover.symbol}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{mover.name}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs sm:text-sm font-mono font-medium">{mover.price}</p>
                <p className={cn(
                  "text-[10px] sm:text-xs font-mono font-bold",
                  mover.changePositive ? "text-success" : "text-error"
                )}>
                  {mover.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {movers.map((mover) => (
            <div
              key={mover.symbol}
              className="card-3d-enhanced p-3 rounded-lg border border-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  mover.changePositive ? "bg-success/10" : "bg-error/10"
                )}>
                  {mover.changePositive ? (
                    <TrendingUp className={cn("h-3 w-3 text-success")} />
                  ) : (
                    <TrendingDown className={cn("h-3 w-3 text-error")} />
                  )}
                </div>
                <p className="text-xs font-bold truncate">{mover.symbol}</p>
              </div>
              <p className="text-[10px] text-muted-foreground truncate mb-1">{mover.name}</p>
              <p className="text-sm font-mono font-medium">{mover.price}</p>
              <p className={cn(
                "text-xs font-mono font-bold",
                mover.changePositive ? "text-success" : "text-error"
              )}>
                {mover.change}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { Bot, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const insights = [
  {
    type: "opportunity",
    title: "NVDA showing strong momentum",
    description: "Breaking above resistance with high volume. Consider entry at $920.",
    time: "2 min ago",
  },
  {
    type: "warning",
    title: "Market volatility increasing",
    description: "VIX index up 15% in last hour. Exercise caution with leveraged positions.",
    time: "15 min ago",
  },
  {
    type: "trend",
    title: "Tech sector outperforming",
    description: "XLK up 2.3% today. AI and semiconductor stocks leading gains.",
    time: "1 hour ago",
  },
];

export function AIInsights() {
  return (
    <div className="dash-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          AI Insights
        </h3>
        <Link href="/ai" className="text-[10px] sm:text-xs text-primary hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className={cn(
              "p-1.5 sm:p-2 rounded-lg shrink-0",
              insight.type === "opportunity" ? "bg-success/10" :
              insight.type === "warning" ? "bg-warning/10" :
              "bg-primary/10"
            )}>
              {insight.type === "opportunity" ? (
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
              ) : insight.type === "warning" ? (
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-warning" />
              ) : (
                <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium mb-1 truncate">{insight.title}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{insight.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

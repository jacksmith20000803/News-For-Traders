import { AlertTriangle, Bot, TrendingUp } from "lucide-react";
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
    description: "VIX index up 15% in the last hour. Exercise caution with leveraged positions.",
    time: "15 min ago",
  },
  {
    type: "trend",
    title: "Tech sector outperforming",
    description: "XLK is up 2.3% today. AI and semiconductor stocks are leading gains.",
    time: "1 hour ago",
  },
];

export function AIInsights() {
  return (
    <div className="dash-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI Market Insights</h3>
        <Link href="/ai" className="text-xs font-bold text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {insights.map((insight) => (
          <div
            key={insight.title}
            className="flex min-h-28 gap-3 rounded-xl border border-border bg-background/45 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                insight.type === "opportunity"
                  ? "bg-success/10"
                  : insight.type === "warning"
                    ? "bg-warning/10"
                    : "bg-primary/10"
              )}
            >
              {insight.type === "opportunity" ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : insight.type === "warning" ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <Bot className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-sm font-semibold">{insight.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{insight.description}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{insight.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

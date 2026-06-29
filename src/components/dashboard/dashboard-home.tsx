import { AIInsights } from "@/components/dashboard/ai-insights";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { PortfolioAllocation } from "@/components/dashboard/portfolio-allocation";
import { RecentTrades } from "@/components/dashboard/recent-trades";
import { TopMovers } from "@/components/dashboard/top-movers";
import { TradingChart } from "@/components/charts/trading-chart";

export function DashboardHome() {
  return (
    <div className="dashboard-shell min-h-full" suppressHydrationWarning>
      <div className="mx-auto max-w-[1800px] space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="dash-panel p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between sm:mb-4">
                <h2 className="text-base font-semibold sm:text-lg">BTC/USD</h2>
                <div className="flex gap-1 sm:gap-2">
                  {["1D", "1W", "1M", "1Y"].map((range) => (
                    <button
                      key={range}
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-white/5 sm:px-3 sm:text-sm"
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <TradingChart initialSymbol="BTC/USD" favorites={[]} variant="dashboard" />
            </div>
          </div>

          <div className="lg:col-span-1">
            <MarketOverview />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TopMovers />
          <PortfolioAllocation />
          <RecentTrades />
        </div>

        <div>
          <AIInsights />
        </div>
      </div>
    </div>
  );
}

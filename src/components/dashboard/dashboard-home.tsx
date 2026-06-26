import { AIInsights } from "@/components/dashboard/ai-insights";
import { KPIRow } from "@/components/dashboard/kpi-row";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { PortfolioAllocation } from "@/components/dashboard/portfolio-allocation";
import { RecentTrades } from "@/components/dashboard/recent-trades";
import { TopMovers } from "@/components/dashboard/top-movers";
import { TradingChart } from "@/components/charts/trading-chart";

export function DashboardHome() {
  return (
    <div className="min-h-full" suppressHydrationWarning>
      <div className="mx-auto max-w-[1800px] px-3 sm:px-4 py-4 sm:py-6">
        <KPIRow />

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-4 mb-4 sm:mb-6">
          <div className="lg:col-span-3">
            <div className="dash-panel p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold">BTC/USD</h2>
                <div className="flex gap-1 sm:gap-2">
                  {["1D", "1W", "1M", "1Y"].map((range) => (
                    <button
                      key={range}
                      className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border border-border hover:bg-white/5 transition-colors"
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <TradingChart initialSymbol="BTC/USD" favorites={[]} />
            </div>
          </div>

          <div className="lg:col-span-1">
            <MarketOverview />
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <TopMovers />
          <PortfolioAllocation />
          <RecentTrades />
          <AIInsights />
        </div>
      </div>
    </div>
  );
}

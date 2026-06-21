import Link from "next/link";
import { getAssetDetail } from "@/lib/trader/queries";
import { PriceChart } from "@/components/charts/price-chart";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Bot,
  Newspaper,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} — Asset Detail` };
}

export default async function AssetPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const data = await getAssetDetail(symbol);

  if (!data.quote && data.news.length === 0 && data.history.length === 0) {
    // Still show page with asset info even without quote
  }


  const positive = (data.quote?.changePercent ?? data.performance ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/heatmap"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Market heatmap
      </Link>

      {/* Header */}
      <div className="dash-panel dash-panel-glow mb-6 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="primary">{data.asset.category}</Badge>
              <Badge variant="outline">{data.asset.assetType}</Badge>
            </div>
            <h1 className="text-3xl font-bold font-mono">{data.asset.symbol}</h1>
            <p className="text-muted-foreground">{data.asset.name}</p>
          </div>
          {data.quote && (
            <div className="text-right">
              <p className="text-3xl font-bold font-mono tabular-nums">
                {data.quote.price.toFixed(data.quote.price < 10 ? 4 : 2)}
              </p>
              <p
                className={`flex items-center justify-end gap-1 font-mono text-sm tabular-nums ${
                  positive ? "text-accent" : "text-destructive"
                }`}
              >
                {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {data.quote.changePercent != null
                  ? `${positive ? "+" : ""}${data.quote.changePercent.toFixed(2)}%`
                  : "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Chart */}
          <section className="dash-panel rounded-2xl p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Price Chart
            </h2>
            <PriceChart
              data={data.history.map((h) => ({
                price: h.price,
                timestamp: h.timestamp.toISOString(),
              }))}
            />
          </section>

          {/* News */}
          <section className="dash-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-cyan-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Related News
              </h2>
            </div>
            {data.news.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related news yet</p>
            ) : (
              <div className="space-y-2">
                {data.news.map((n) => (
                  <Link
                    key={n.id}
                    href={`/news/${n.id}`}
                    className="block rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
                  >
                    <p className="text-sm font-medium line-clamp-1">{n.headline}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {n.source.name} · {formatRelative(n.publishedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Discussions */}
          <section className="dash-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Related Discussions
              </h2>
            </div>
            {data.discussions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No discussions —{" "}
                <Link href="/community/new" className="text-cyan-400 hover:underline">
                  start one
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {data.discussions.map((d) => (
                  <Link
                    key={d.id}
                    href={`/community/${d.id}`}
                    className="block rounded-lg px-2 py-2 hover:bg-white/5"
                  >
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.author.name} · {d._count.comments} comments
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Sentiment */}
          <div className="dash-panel rounded-2xl p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sentiment
            </h3>
            <p
              className={`text-xl font-bold ${
                data.sentiment.label === "Bullish"
                  ? "text-accent"
                  : data.sentiment.label === "Bearish"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {data.sentiment.label}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {data.discussions.length} community discussions
            </p>
          </div>

          {/* Performance */}
          <div className="dash-panel rounded-2xl p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Historical Performance
            </h3>
            {data.performance != null ? (
              <p
                className={`text-xl font-bold font-mono tabular-nums ${
                  data.performance >= 0 ? "text-accent" : "text-destructive"
                }`}
              >
                {data.performance >= 0 ? "+" : ""}
                {data.performance.toFixed(2)}%
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient history</p>
            )}
          </div>

          {/* AI Summary */}
          <div className="dash-panel rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Summary
              </h3>
            </div>
            {data.aiConfigured ? (
              <Link
                href={`/ai?q=${encodeURIComponent(`Analyze ${data.asset.symbol} current outlook`)}`}
                className="text-sm text-cyan-400 hover:underline"
              >
                Generate AI analysis →
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">AI provider not configured</p>
            )}
          </div>

          {/* Quick actions */}
          <div className="dash-panel rounded-2xl p-4 space-y-2">
            <Link
              href="/dashboard/watchlists"
              className="block text-sm text-cyan-400 hover:underline"
            >
              Add to watchlist
            </Link>
            <Link
              href="/dashboard/portfolio"
              className="block text-sm text-cyan-400 hover:underline"
            >
              Add to portfolio
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { MarketStrip } from "@/components/dashboard/market-strip";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { LiveNewsFeed, TrendingDiscussions } from "@/components/terminal/live-feed";
import { SidebarWatchlist } from "@/components/terminal/sidebar-watchlist";
import { isAnyProviderConfigured } from "@/lib/providers/news";
import { isAIConfigured } from "@/lib/providers/ai/openai";
import Link from "next/link";
import { Bot, BookOpen, MessageSquare } from "lucide-react";
import { NotificationBellWrapper } from "@/components/terminal/sidebar-alerts";

export default async function HomePage() {
  const user = await getCurrentUser();
  const configured = isAnyProviderConfigured();
  const aiConfigured = isAIConfigured();

  const [news, discussions, quotes, articleCount, topNews] = await Promise.all([
    db.news.findMany({
      include: {
        source: { select: { name: true } },
        assets: { select: { symbol: true, assetType: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 20,
    }),
    db.discussion.findMany({
      include: { _count: { select: { comments: true } } },
      orderBy: [{ upvoteCount: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.marketQuote.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    db.article.count({ where: { status: "PUBLISHED" } }),
    db.news.findFirst({
      where: { OR: [{ importance: "CRITICAL" }, { importance: "HIGH" }, { isPinned: true }] },
      orderBy: { publishedAt: "desc" },
      select: { id: true, headline: true },
    }),
  ]);

  return (
    <div className="min-h-full">
      <MarketStrip initialQuotes={quotes} configured={configured} />

      <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-5 sm:px-4 lg:px-6">
        {/* Hero cards */}
        <HeroCards
          topHeadline={topNews?.headline}
          topHeadlineId={topNews?.id}
          newsCount={news.length}
          discussionCount={discussions.length}
        />

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Left + Center: News + AI */}
          <div className="space-y-4 lg:col-span-8">
            <section className="dash-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Breaking News Feed
                </h2>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive live-pulse">
                  LIVE
                </span>
              </div>
              <LiveNewsFeed initialNews={news} configured={configured} />
            </section>

            <section className="dash-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  AI Analysis Feed
                </h2>
              </div>
              {aiConfigured ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ask the AI assistant for real-time market interpretation, macro analysis, and asset impact assessments.
                  </p>
                  <Link
                    href="/ai"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-blue-500"
                  >
                    <Bot className="h-4 w-4" />
                    Launch AI Terminal
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">AI provider not configured.</p>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4 lg:col-span-4">
            <div className="dash-panel p-4">
              <SidebarWatchlist />
            </div>
            {user && (
              <div className="dash-panel p-4">
                <NotificationBellWrapper />
              </div>
            )}
            <div className="dash-panel p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Latest Alerts
              </h3>
              {!configured ? (
                <p className="text-xs text-muted-foreground">Live data provider not configured.</p>
              ) : news.length === 0 ? (
                <p className="text-xs text-muted-foreground">No alerts yet.</p>
              ) : (
                <div className="space-y-2">
                  {news.slice(0, 6).map((n) => (
                    <Link
                      key={n.id}
                      href={`/news/${n.id}`}
                      className="block rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/5 hover:text-cyan-400 line-clamp-2"
                    >
                      {n.headline}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="dash-panel p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Economic Events
              </h3>
              <p className="text-xs text-muted-foreground">Feature not yet available</p>
            </div>
          </aside>
        </div>

        {/* Lower section */}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="dash-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Trending Discussions
              </h2>
            </div>
            <TrendingDiscussions discussions={discussions} />
          </section>

          <section className="dash-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Research Plaza
              </h2>
            </div>
            {articleCount > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {articleCount} published analyses from the community.
                </p>
                <Link href="/knowledge" className="text-xs font-medium text-cyan-400 hover:underline">
                  Browse all research →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No published analyses yet.{" "}
                <Link href="/knowledge/new" className="text-cyan-400 hover:underline">
                  Publish one
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

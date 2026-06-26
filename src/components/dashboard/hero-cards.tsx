import Link from "next/link";
import { Bot, Calendar, TrendingUp, Zap, AlertTriangle } from "lucide-react";

interface HeroCardsProps {
  topHeadline?: string | null;
  topHeadlineId?: string | null;
  newsCount: number;
  discussionCount: number;
  aiConfigured: boolean;
}

export function HeroCards({
  topHeadline,
  topHeadlineId,
  newsCount,
  discussionCount,
  aiConfigured,
}: HeroCardsProps) {

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* Breaking Event */}
      <div className="hero-card group">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
            Breaking Event
          </span>
        </div>
        {topHeadline && topHeadlineId ? (
          <Link href={`/news/${topHeadlineId}`} className="block group-hover:text-cyan-400 transition-colors">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{topHeadline}</p>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No breaking news yet</p>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">{newsCount} items in feed</p>
      </div>

      {/* AI Summary */}
      <div className="hero-card">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
            <Bot className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
            AI Summary
          </span>
        </div>
        {aiConfigured ? (
          <>
            <p className="text-sm text-muted-foreground leading-snug">
              Get instant AI-powered market analysis with live citations.
            </p>
            <Link
              href="/ai"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
            >
              <Zap className="h-3 w-3" />
              Open AI Assistant
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">AI provider not configured.</p>
        )}
      </div>

      {/* Macro Calendar */}
      <div className="hero-card">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
            Macro Calendar
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          Economic events and central bank decisions will appear here when calendar data is configured.
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">Feature not yet available</p>
      </div>

      {/* Market Sentiment */}
      <div className="hero-card">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            Sentiment
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          {discussionCount > 0
            ? `${discussionCount} active community discussions shaping market narrative.`
            : "Community sentiment tracking activates with discussions."}
        </p>
        <Link
          href="/community"
          className="mt-3 inline-flex text-xs font-medium text-accent hover:underline"
        >
          View discussions →
        </Link>
      </div>
    </div>
  );
}

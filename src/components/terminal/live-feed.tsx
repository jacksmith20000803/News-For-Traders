"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NewsCard } from "@/components/news/news-card";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { SkeletonCard } from "@/components/terminal/skeleton";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";

interface NewsItem {
  id: string;
  headline: string;
  summary?: string | null;
  source: { name: string };
  publishedAt: Date | string;
  importance: ImportanceLevel;
  reliabilityStatus: ReliabilityStatus;
  assets: { symbol: string; assetType: string }[];
  aiInterpretation?: unknown;
  _count?: { comments: number };
}

interface LiveNewsFeedProps {
  initialNews: NewsItem[];
  configured: boolean;
}

export function LiveNewsFeed({ initialNews, configured }: LiveNewsFeedProps) {
  const [news, setNews] = useState(initialNews);
  const [loading] = useState(false);

  useEffect(() => {
    return subscribeSSE((event, data) => {
      if (event === "news" && (data as { type?: string }).type === "news.created") {
        const payload = data as { id: string; headline: string };
        fetch(`/api/news/${payload.id}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data) {
              setNews((prev) => [json.data, ...prev.filter((n) => n.id !== json.data.id)].slice(0, 20));
            }
          })
          .catch(() => {});
      }
    });
  }, []);

  if (!configured && news.length === 0) {
    return (
      <div className="terminal-panel p-8 text-center">
        <p className="text-sm text-muted-foreground">Live data provider not configured.</p>
        <p className="text-xs text-muted-foreground mt-2">
          Set FINNHUB_API_KEY, ALPHAVANTAGE_API_KEY, POLYGON_API_KEY, or TWELVEDATA_API_KEY
          and run ingestion.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="terminal-panel p-8 text-center">
        <p className="text-sm text-muted-foreground">No news items yet.</p>
        <p className="text-xs text-muted-foreground mt-2">Run npm run ingest:news to fetch live headlines.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {news.map((item) => (
        <NewsCard
          key={item.id}
          id={item.id}
          headline={item.headline}
          summary={item.summary}
          source={item.source?.name ?? "Unknown"}
          publishedAt={item.publishedAt}
          importance={item.importance}
          reliabilityStatus={item.reliabilityStatus}
          assets={item.assets}
          aiInterpretation={item.aiInterpretation as import("@/lib/constants").AIInterpretation | null}
          commentCount={item._count?.comments ?? 0}
        />
      ))}
    </div>
  );
}

export function TrendingDiscussions({
  discussions,
}: {
  discussions: Array<{
    id: string;
    title: string;
    upvoteCount: number;
    downvoteCount: number;
    _count: { comments: number };
  }>;
}) {
  if (discussions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No discussions yet.{" "}
        <Link href="/community/new" className="text-primary hover:underline">
          Start one
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {discussions.map((d) => (
        <Link
          key={d.id}
          href={`/community/${d.id}`}
          className="block rounded border border-border/50 px-3 py-2 hover:border-primary/30 transition-colors"
        >
          <p className="text-sm font-medium line-clamp-1">{d.title}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {d.upvoteCount - d.downvoteCount} votes · {d._count.comments} comments
          </p>
        </Link>
      ))}
    </div>
  );
}

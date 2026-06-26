"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NewsCard } from "@/components/news/news-card";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { SkeletonCard } from "@/components/terminal/skeleton";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

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
  imageUrl?: string | null;
}

interface LiveNewsFeedProps {
  initialNews: NewsItem[];
  configured: boolean;
}

export function LiveNewsFeed({ initialNews, configured }: LiveNewsFeedProps) {
  const [news, setNews] = useState(initialNews);
  const [loading] = useState(false);
  const [layout, setLayout] = useState<"list" | "card">("list");

  useEffect(() => {
    const unsubSSE = subscribeSSE((event, data) => {
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

    const unsubSync = subscribeRealtimeSync((data) => {
      if (data.news.length === 0) return;
      const latestId = data.news[0].id;
      setNews((prev) => {
        if (prev[0]?.id === latestId) return prev;
        fetch(`/api/news/${latestId}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data) {
              setNews((p) => [json.data, ...p.filter((n) => n.id !== json.data.id)].slice(0, 20));
            }
          })
          .catch(() => {});
        return prev;
      });
    });

    return () => { unsubSSE(); unsubSync(); };
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={layout === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setLayout("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === "card" ? "default" : "outline"}
            size="sm"
            onClick={() => setLayout("card")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={layout === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
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
            imageUrl={item.imageUrl}
            layout={layout}
          />
        ))}
      </div>
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

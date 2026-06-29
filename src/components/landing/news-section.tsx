"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import Image from "next/image";
import { readJsonResponse } from "@/lib/api/client";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  publishedAt: string;
  source: { name: string };
  imageUrl: string | null;
  assets: { symbol: string; assetType: string }[];
}

interface NewsSectionProps {
  coinSymbols?: string[];
}

const importanceColors = {
  LOW: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  MEDIUM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  HIGH: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
};

const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
};

const stripHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const fallbackNews: NewsItem[] = [
  {
    id: "fallback-market-brief",
    headline: "Market news is reconnecting",
    summary: "Live news is temporarily unavailable. The feed will refresh automatically when the connection returns.",
    importance: "MEDIUM",
    publishedAt: new Date().toISOString(),
    source: { name: "TRADX" },
    imageUrl: null,
    assets: [],
  },
];

const landingNewsCache = new Map<string, NewsItem[]>();

export function NewsSection({ coinSymbols }: NewsSectionProps) {
  const cacheKey = coinSymbols?.length ? coinSymbols.map((symbol) => symbol.toUpperCase()).sort().join(",") : "all";
  const cachedNews = landingNewsCache.get(cacheKey);
  const [news, setNews] = useState<NewsItem[]>(cachedNews ?? []);
  const [loading, setLoading] = useState(!cachedNews);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = landingNewsCache.get(cacheKey);
    const coinSymbolList = cacheKey === "all" ? [] : cacheKey.split(",");
    window.queueMicrotask(() => {
      if (cancelled) return;
      if (cached) {
        setNews(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    });

    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news?limit=6&lite=true", { cache: "no-store" });
        if (!res.ok) throw new Error(`News request failed with ${res.status}`);
        const json = await readJsonResponse<{
          success: boolean;
          data?: { news?: NewsItem[] };
        }>(res);
        const incomingNews = json.data?.news ?? [];
        if (json.success && incomingNews.length > 0) {
          let filteredNews = incomingNews;
          
          // Filter news by coin symbols if provided
          if (coinSymbolList.length > 0) {
            filteredNews = incomingNews.filter((item: NewsItem) => {
              if (!item.assets || item.assets.length === 0) return false;
              return item.assets.some(asset => 
                coinSymbolList.includes(asset.symbol.replace("/USD", "").toUpperCase())
              );
            });
          }
          
          // If no coin-specific news, fall back to general news
          const nextNews = filteredNews.length > 0 ? filteredNews : incomingNews;
          landingNewsCache.set(cacheKey, nextNews);
          if (!cancelled) setNews(nextNews);
        }
      } catch {
        if (!cancelled) setNews(fallbackNews);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchNews();
    
    // Refresh news every 5 minutes
    const interval = setInterval(fetchNews, 300000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cacheKey]);

  if (loading) {
    return (
      <section ref={sectionRef} className="relative py-20 bg-[#0A0A0B]" suppressHydrationWarning>
        <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
          <div className="text-center py-12" suppressHydrationWarning>
            <p className="text-gray-400" suppressHydrationWarning>Loading news...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative py-20 bg-gray-50 dark:bg-[#0a0c0c]" suppressHydrationWarning>
      <div className="absolute inset-0" suppressHydrationWarning>
        <div
          className="absolute inset-0"
          suppressHydrationWarning
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-12"
          suppressHydrationWarning
        >
          <div className="flex items-center justify-between mb-4" suppressHydrationWarning>
            <div className="flex items-center gap-3" suppressHydrationWarning>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10" suppressHydrationWarning>
                <TrendingUp className="w-5 h-5 text-emerald-400" suppressHydrationWarning />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white" suppressHydrationWarning>Latest Market News</h2>
            </div>
            <div suppressHydrationWarning>
              <ButtonLink
                href="/news"
                variant="outline"
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                View All
                <ArrowRight className="w-4 h-4" suppressHydrationWarning />
              </ButtonLink>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl" suppressHydrationWarning>
            Stay informed with real-time market updates and expert analysis from trusted sources.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3" suppressHydrationWarning>
          {news.map((item: NewsItem, index: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group"
              suppressHydrationWarning
            >
              <div className="h-full p-6 rounded-2xl bg-white dark:bg-[#0a0c0c] border border-gray-200 dark:border-white/6 hover:border-gray-300 dark:hover:border-white/10 transition-colors" suppressHydrationWarning>
                <div className="flex items-start justify-between mb-4" suppressHydrationWarning>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full border ${importanceColors[item.importance || 'LOW']}`}
                    suppressHydrationWarning
                  >
                    {item.importance || 'LOW'}
                  </span>
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs" suppressHydrationWarning>
                    <Clock className="w-3.5 h-3.5" suppressHydrationWarning />
                    {timeAgo(item.publishedAt)}
                  </div>
                </div>

                {item.imageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden relative h-32" suppressHydrationWarning>
                    <Image
                      src={item.imageUrl}
                      alt={stripHtml(item.headline)}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" suppressHydrationWarning>
                  {stripHtml(item.headline)}
                </h3>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2" suppressHydrationWarning>{stripHtml(item.summary)}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/6" suppressHydrationWarning>
                  <span className="text-xs text-gray-500 dark:text-gray-500" suppressHydrationWarning>{item.source?.name || 'Unknown'}</span>
                  <div suppressHydrationWarning>
                    <ButtonLink
                      href={`/news/${item.id}`}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      Read More
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 text-center sm:hidden"
          suppressHydrationWarning
        >
          <div suppressHydrationWarning>
            <ButtonLink
              href="/news"
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-900 dark:text-white border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              View All News
              <ArrowRight className="w-4 h-4" suppressHydrationWarning />
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
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
const NEWS_REFRESH_MS = 60_000;

export function NewsSection({ coinSymbols }: NewsSectionProps) {
  const cacheKey = coinSymbols?.length ? coinSymbols.map((symbol) => symbol.toUpperCase()).sort().join(",") : "all";
  const cachedNews = landingNewsCache.get(cacheKey);
  const [news, setNews] = useState<NewsItem[]>(cachedNews ?? []);
  const [loading, setLoading] = useState(!cachedNews);

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
    
    const interval = setInterval(fetchNews, NEWS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cacheKey]);

  if (loading) {
    return (
      <section className="relative py-20 landing-section-surface" suppressHydrationWarning>
        <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
          <div className="text-center py-12" suppressHydrationWarning>
            <p className="text-gray-500 dark:text-gray-400" suppressHydrationWarning>Loading news...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-20 landing-section-surface" suppressHydrationWarning>
      <div className="absolute inset-0 landing-hero-grid opacity-70" suppressHydrationWarning />

      <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-12"
          suppressHydrationWarning
        >
          <div className="mb-4 flex items-center justify-between gap-4" suppressHydrationWarning>
            <div className="flex items-center gap-3" suppressHydrationWarning>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 shadow-[0_0_28px_rgba(16,185,129,0.16)]" suppressHydrationWarning>
                <TrendingUp className="w-5 h-5 text-emerald-400" suppressHydrationWarning />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Market updates</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl dark:text-white" suppressHydrationWarning>Latest Market News</h2>
              </div>
            </div>
            <div suppressHydrationWarning>
              <ButtonLink
                href="/news"
                className="landing-button-shine hidden min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 text-sm font-black text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.24)] sm:flex"
              >
                View all news
                <ArrowRight className="w-4 h-4" suppressHydrationWarning />
              </ButtonLink>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-8 text-gray-600 dark:text-gray-400 sm:text-lg" suppressHydrationWarning>
            Stay informed with real-time market updates and expert analysis from trusted sources.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3" suppressHydrationWarning>
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
              <article
                data-news-card={item.id}
                className="landing-premium-card h-full rounded-2xl p-4 transition duration-300 hover:-translate-y-1 sm:p-5"
                suppressHydrationWarning
              >
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
                  <div className="mb-4 relative h-44 overflow-hidden rounded-xl" suppressHydrationWarning>
                    <Image
                      src={item.imageUrl}
                      alt={stripHtml(item.headline)}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/34 to-transparent" />
                  </div>
                )}

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" suppressHydrationWarning>
                  {stripHtml(item.headline)}
                </h3>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2" suppressHydrationWarning>{stripHtml(item.summary)}</p>

                <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-white/6" suppressHydrationWarning>
                  <span className="text-xs text-gray-500 dark:text-gray-500" suppressHydrationWarning>{item.source?.name || 'Unknown'}</span>
                  <div suppressHydrationWarning>
                    <ButtonLink
                      href={`/news/${item.id}`}
                      className="gap-1 text-xs font-black text-emerald-500 hover:text-emerald-400 dark:text-emerald-300"
                    >
                      Read More
                    </ButtonLink>
                  </div>
                </div>
              </article>
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

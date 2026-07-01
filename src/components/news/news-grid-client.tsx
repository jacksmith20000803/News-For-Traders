"use client";

import { NewsCard } from "@/components/news/news-card";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { readJsonResponse } from "@/lib/api/client";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import { ChevronDown, Heart, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "card";

interface NewsItem {
  id: string;
  headline: string;
  summary: string | null;
  publishedAt: Date | string;
  importance: ImportanceLevel;
  reliabilityStatus: ReliabilityStatus;
  imageUrl: string | null;
  source: {
    name: string;
  };
  assets: Array<{
    symbol: string;
    assetType: string;
  }>;
  _count?: { comments: number };
}

interface NewsGridClientProps {
  news: NewsItem[];
  initialFavoriteIds?: string[];
  allCoins?: string[];
}

const PAGE_SIZE = 20;
const NEWS_REFRESH_MS = 60_000;

type NewsPageResponse = {
  news: NewsItem[];
  favoriteNewsIds?: string[];
  pagination: { page: number; totalPages: number };
};

const newsPageCache = new Map<string, Promise<NewsPageResponse>>();

export function NewsGridClient({
  news: initialNews,
  initialFavoriteIds = [],
  allCoins = [],
}: NewsGridClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [coinFilter, setCoinFilter] = useState("");
  const [coinMenuOpen, setCoinMenuOpen] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(initialFavoriteIds));
  const [allNews, setAllNews] = useState<NewsItem[]>(initialNews);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialNews.length >= 20);
  const observerTarget = useRef<HTMLDivElement>(null);
  const coinMenuRef = useRef<HTMLDivElement>(null);
  const searchPending = searchText.trim() !== searchQuery;
  const coinOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allCoins
            .map((coin) => coin.trim().toUpperCase().replace(/\/USD$/, ""))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [allCoins]
  );

  const fetchNewsPage = useCallback(async (targetPage: number, options?: { force?: boolean }) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(PAGE_SIZE),
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (coinFilter) params.set("coin", coinFilter);
    if (favoriteOnly) params.set("favorites", "true");
    params.set("fast", "true");

    const cacheKey = params.toString();
    const cached = options?.force ? null : newsPageCache.get(cacheKey);
    if (cached) return cached;

    const request = fetch(`/api/news?${cacheKey}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await readJsonResponse<{
          success: boolean;
          error?: string;
          data?: NewsPageResponse;
        }>(res);
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load news");
        }
        return json.data;
      })
      .catch((error) => {
        newsPageCache.delete(cacheKey);
        throw error;
      });

    if (!options?.force) {
      newsPageCache.set(cacheKey, request);
    }
    return request;
  }, [coinFilter, favoriteOnly, searchQuery]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const data = await fetchNewsPage(page + 1);
      setAllNews(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = data.news.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      if (data.favoriteNewsIds?.length) {
        setFavoriteIds((prev) => new Set([...prev, ...data.favoriteNewsIds!]));
      }
      setPage(data.pagination.page);
      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to load more news:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchNewsPage, hasMore, loading, page]);

  useEffect(() => {
    const saved = localStorage.getItem("news-view-mode") as ViewMode | null;
    if (saved === "list" || saved === "card") {
      const frame = window.requestAnimationFrame(() => setViewMode(saved));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    const handleViewChange = (e: CustomEvent<{ mode: ViewMode }>) => {
      setViewMode(e.detail.mode);
    };
    window.addEventListener("news-view-change", handleViewChange as EventListener);
    return () => {
      window.removeEventListener("news-view-change", handleViewChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchText.trim()), 160);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!coinMenuOpen) return;

    const closeOnOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (target && coinMenuRef.current?.contains(target)) return;
      setCoinMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("focusin", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("focusin", closeOnOutside);
    };
  }, [coinMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchNewsPage(1, { force: true });
        if (cancelled) return;
        setAllNews(data.news);
        setFavoriteIds(new Set(data.favoriteNewsIds ?? []));
        setPage(data.pagination.page);
        setHasMore(data.pagination.page < data.pagination.totalPages);
      } catch (error) {
        console.error("Failed to refresh news:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, searchQuery ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [coinFilter, favoriteOnly, fetchNewsPage, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const refreshLatestNews = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const data = await fetchNewsPage(1, { force: true });
        if (cancelled) return;
        setAllNews((prev) => {
          const incomingIds = new Set(data.news.map((item) => item.id));
          const olderItems = prev.filter((item) => !incomingIds.has(item.id));
          return [...data.news, ...olderItems].sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        });
        if (data.favoriteNewsIds) {
          setFavoriteIds((prev) => new Set([...prev, ...data.favoriteNewsIds!]));
        }
        setHasMore((current) => data.pagination.page < data.pagination.totalPages || current);
      } catch (error) {
        console.error("Failed to update live news:", error);
      }
    };

    const interval = window.setInterval(refreshLatestNews, NEWS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchNewsPage]);

  const updateCoinFilter = (value: string) => {
    setLoading(true);
    setCoinFilter(value);
    setCoinMenuOpen(false);
  };

  const toggleFavoriteFilter = () => {
    setLoading(true);
    setFavoriteOnly((current) => !current);
  };

  const updateSearchText = (value: string) => {
    setSearchText(value);
    if (value.trim() !== searchQuery) setLoading(true);
  };

  // Filter and sort news using useMemo
  const displayedNews = useMemo(() => {
    const filtered = [...allNews];
    filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return filtered;
  }, [allNews]);

  const handleFavoriteChange = useCallback((newsId: string, saved: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(newsId);
      else next.delete(newsId);
      return next;
    });
    if (!saved && favoriteOnly) {
      setAllNews((prev) => prev.filter((item) => item.id !== newsId));
    }
  }, [favoriteOnly]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          await loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <>
      <div className="news-filter-shell relative z-[70] mb-6 rounded-[1.35rem] border border-gray-200 bg-white/90 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-[#0b0f12]/88 dark:shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_160px_auto]">
          <label className="group relative flex h-12 items-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/90 px-4 text-gray-900 transition-all focus-within:border-emerald-400/60 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus-within:border-emerald-300/50 dark:focus-within:bg-white/[0.07]">
            <Search className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-focus-within:text-emerald-500 dark:text-gray-500" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => updateSearchText(event.target.value)}
              placeholder="Search market news, sources, assets..."
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {(loading || searchPending) && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" />
            )}
          </label>

          <div className="relative" ref={coinMenuRef}>
            <button
              type="button"
              onClick={() => setCoinMenuOpen((open) => !open)}
              className={cn(
                "flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-4",
                coinMenuOpen || coinFilter
                  ? "border-blue-400/60 bg-blue-500/10 text-blue-700 focus-visible:ring-blue-500/15 dark:border-blue-300/45 dark:bg-blue-500/12 dark:text-blue-200"
                  : "border-gray-200 bg-gray-50/90 text-gray-900 hover:border-blue-300/60 hover:bg-white focus-visible:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-blue-300/30 dark:hover:bg-white/[0.07]"
              )}
              aria-haspopup="listbox"
              aria-expanded={coinMenuOpen}
            >
              <span className="min-w-0 truncate">{coinFilter || "All Coins"}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                  coinMenuOpen && "rotate-180"
                )}
              />
            </button>

            {coinMenuOpen && (
              <div className="absolute right-0 top-full z-[9999] mt-2 w-44 rounded-2xl border border-blue-200/80 bg-white/98 p-2 text-center shadow-2xl shadow-blue-950/15 ring-1 ring-blue-500/10 backdrop-blur-xl dark:border-blue-300/20 dark:bg-[#071012]/98 dark:shadow-black/50 dark:ring-blue-300/15">
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Filter news by coin">
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      updateCoinFilter("");
                    }}
                    onClick={() => updateCoinFilter("")}
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 active:scale-95 active:bg-blue-500/20",
                      !coinFilter
                        ? "bg-blue-500/12 text-blue-700 ring-1 ring-blue-400/35 dark:bg-blue-400/15 dark:text-blue-100"
                        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-blue-400/12 dark:hover:text-blue-100"
                    )}
                    role="option"
                    aria-selected={!coinFilter}
                  >
                    All Coins
                  </button>
                  {coinOptions.map((coin) => (
                    <button
                      key={coin}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        updateCoinFilter(coin);
                      }}
                      onClick={() => updateCoinFilter(coin)}
                      className={cn(
                      "flex w-full items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 active:scale-95 active:bg-blue-500/20",
                      coinFilter === coin
                          ? "bg-blue-500/12 text-blue-700 ring-1 ring-blue-400/35 dark:bg-blue-400/15 dark:text-blue-100"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-blue-400/12 dark:hover:text-blue-100"
                      )}
                      role="option"
                      aria-selected={coinFilter === coin}
                    >
                      {coin}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleFavoriteFilter}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-extrabold transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4",
              favoriteOnly
                ? "border-red-400/50 bg-red-500/10 text-red-600 shadow-[0_14px_32px_rgba(239,68,68,0.16)] focus-visible:ring-red-500/20 dark:border-red-300/40 dark:bg-red-500/15 dark:text-red-300"
                : "border-gray-200 bg-gray-50/90 text-gray-800 hover:bg-white focus-visible:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
            )}
            aria-pressed={favoriteOnly}
          >
            <Heart className={cn("h-4 w-4 transition-colors", favoriteOnly && "fill-current text-red-500")} />
            Favorites
          </button>
        </div>
        {(loading || searchPending) && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating news feed...
          </div>
        )}
      </div>

      <div
        className={viewMode === "list" ? "flex flex-col gap-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}
        id="news-grid"
        aria-busy={loading || searchPending}
      >
        {displayedNews.map((item) => (
          <NewsCard
            key={item.id}
            id={item.id}
            headline={item.headline}
            summary={item.summary}
            source={item.source.name}
            publishedAt={item.publishedAt}
            importance={item.importance}
            reliabilityStatus={item.reliabilityStatus}
            imageUrl={item.imageUrl}
            assets={item.assets.map((a) => ({ symbol: a.symbol, assetType: a.assetType }))}
            commentCount={item._count?.comments ?? 0}
            initialFavorite={favoriteIds.has(item.id)}
            onFavoriteChange={handleFavoriteChange}
            layout={viewMode}
          />
        ))}
        {displayedNews.length === 0 && !loading && !searchPending && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No news matched the current filters.
          </div>
        )}
        <div ref={observerTarget} className="h-10" />
        {loading && <div className="py-4 text-center text-sm font-medium text-muted-foreground">Loading news...</div>}
      </div>
    </>
  );
}

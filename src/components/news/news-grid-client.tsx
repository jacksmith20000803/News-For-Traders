"use client";

import { NewsCard } from "@/components/news/news-card";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { readJsonResponse } from "@/lib/api/client";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";

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
}

export function NewsGridClient({ news: initialNews, initialFavoriteIds = [] }: NewsGridClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [coinFilter, setCoinFilter] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(initialFavoriteIds));
  const [allNews, setAllNews] = useState<NewsItem[]>(initialNews);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialNews.length >= 20);
  const observerTarget = useRef<HTMLDivElement>(null);
  const didRunInitialFilterRefresh = useRef(false);

  const fetchNewsPage = useCallback(async (targetPage: number) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: "20",
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (coinFilter) params.set("coin", coinFilter);
    if (favoriteOnly) params.set("favorites", "true");

    const res = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
    const json = await readJsonResponse<{
      success: boolean;
      error?: string;
      data?: {
        news: NewsItem[];
        favoriteNewsIds?: string[];
        pagination: { page: number; totalPages: number };
      };
    }>(res);
    if (!json.success) throw new Error(json.error ?? "Failed to load news");
    return json.data as {
      news: NewsItem[];
      favoriteNewsIds?: string[];
      pagination: { page: number; totalPages: number };
    };
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

  // Wire up search input
  useEffect(() => {
    const searchInput = document.getElementById("news-search") as HTMLInputElement;
    if (searchInput) {
      const handleSearch = (e: Event) => {
        setSearchQuery((e.target as HTMLInputElement).value);
      };
      searchInput.addEventListener("input", handleSearch);
      return () => searchInput.removeEventListener("input", handleSearch);
    }
  }, []);

  // Wire up coin filter dropdown
  useEffect(() => {
    const coinFilter = document.getElementById("coin-filter") as HTMLSelectElement;
    if (coinFilter) {
      const handleFilter = (e: Event) => {
        setCoinFilter((e.target as HTMLSelectElement).value);
      };
      coinFilter.addEventListener("change", handleFilter);
      return () => coinFilter.removeEventListener("change", handleFilter);
    }
  }, []);

  // Wire up favorites filter button
  useEffect(() => {
    const favoritesBtn = document.getElementById("favorites-filter");
    if (!favoritesBtn) return;

    const handleFavorites = () => setFavoriteOnly((current) => !current);
    favoritesBtn.addEventListener("click", handleFavorites);
    return () => {
      favoritesBtn.removeEventListener("click", handleFavorites);
    };
  }, []);

  useEffect(() => {
    const favoritesBtn = document.getElementById("favorites-filter");
    if (!favoritesBtn) return;
    favoritesBtn.classList.toggle("bg-red-500/10", favoriteOnly);
    favoritesBtn.classList.toggle("border-red-500/50", favoriteOnly);
    favoritesBtn.classList.toggle("text-red-500", favoriteOnly);
  }, [favoriteOnly]);

  useEffect(() => {
    const isFirstDefaultLoad =
      !didRunInitialFilterRefresh.current &&
      !searchQuery.trim() &&
      !coinFilter &&
      !favoriteOnly;

    didRunInitialFilterRefresh.current = true;
    if (isFirstDefaultLoad) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchNewsPage(1);
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

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-3" id="news-grid">
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
            layout="list"
          />
        ))}
        <div ref={observerTarget} className="h-10" />
        {loading && <div className="text-center py-4 text-muted-foreground">Loading more news...</div>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="news-grid">
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
            layout="card"
          />
      ))}
      <div ref={observerTarget} className="h-10" />
      {loading && <div className="text-center py-4 text-muted-foreground">Loading more news...</div>}
    </div>
  );
}

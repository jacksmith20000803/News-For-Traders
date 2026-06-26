"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ResultSection = {
  items: Array<Record<string, unknown>>;
  total: number;
  page?: number;
  limit?: number;
};

const TYPES = [
  { value: "all", label: "All" },
  { value: "news", label: "News" },
  { value: "articles", label: "Articles" },
  { value: "discussions", label: "Discussions" },
  { value: "users", label: "Users" },
  { value: "comments", label: "Comments" },
] as const;

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialType = searchParams.get("type") ?? "all";

  const [query, setQuery] = useState(initialQ);
  const [type, setType] = useState(initialType);
  const [results, setResults] = useState<Record<string, ResultSection> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(!!initialQ);

  const runSearch = useCallback(async (q: string, t: string) => {
    if (!q.trim()) {
      setResults(null);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${t}`
      );
      const json = await res.json();
      setResults(json.success ? json.data : null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) {
      const timer = setTimeout(() => runSearch(initialQ, initialType), 0);
      return () => clearTimeout(timer);
    }
  }, [initialQ, initialType, runSearch]);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    router.replace(`/search?q=${encodeURIComponent(q)}&type=${type}`, { scroll: false });
    runSearch(q, type);
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query)}&type=${newType}`, { scroll: false });
      runSearch(query, newType);
    }
  };

  const getHref = (key: string, item: Record<string, unknown>) => {
    if (key === "news") return `/news/${item.id}`;
    if (key === "articles") return `/knowledge/${item.slug}`;
    if (key === "discussions") return `/community/${item.id}`;
    if (key === "users") return `/search?q=${encodeURIComponent(query)}&type=users`;
    if (key === "comments") return `/search?q=${encodeURIComponent(query)}&type=comments`;
    return "#";
  };

  const getTitle = (item: Record<string, unknown>) =>
    String(item.headline ?? item.title ?? item.name ?? item.content ?? "").slice(0, 150);

  const totalResults = results
    ? Object.values(results).reduce((sum, s) => sum + (s?.total ?? 0), 0)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Global Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search news, research, discussions, and users
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search news, articles, discussions, users…"
              className="w-full rounded-xl border border-white/8 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            {isLoading ? "…" : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                type === t.value
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && searched && results && totalResults === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {!isLoading && results && (
        <div className="space-y-6">
          {totalResults > 0 && (
            <p className="text-xs text-muted-foreground">{totalResults} total results</p>
          )}
          {Object.entries(results).map(([key, section]) => {
            if (!section?.items?.length) return null;
            return (
              <div key={`section-${key}`}>
                <h2 className="mb-1 text-sm font-semibold capitalize text-cyan-400">{key}</h2>
                <p className="mb-3 text-xs text-muted-foreground">{section.total} results</p>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const itemId = String(item.id ?? item.slug ?? "");
                    const href = getHref(key, item);
                    return (
                      <Link key={`${key}-${itemId}`} href={href}>
                        <div className="dash-panel rounded-xl p-4 transition-all hover:border-cyan-500/20">
                          <p className="font-medium text-sm">{getTitle(item)}</p>
                          {item.summary != null && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {String(item.summary)}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            {item.reputation !== undefined && (
                              <Badge variant="outline">Rep {String(item.reputation)}</Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] capitalize">{key}</Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}

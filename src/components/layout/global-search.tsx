"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchSuggestion {
  id: string;
  type: string;
  title: string;
  href: string;
}

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=all&limit=5`);
      const json = await res.json();
      if (!json.success) return;

      const items: SearchSuggestion[] = [];
      const data = json.data as Record<string, { items: Array<Record<string, unknown>> }>;

      for (const [type, section] of Object.entries(data)) {
        if (!section?.items) continue;
        for (const item of section.items.slice(0, 3)) {
          const id = String(item.id);
          let href = "#";
          let title = String(item.headline ?? item.title ?? item.name ?? item.content ?? "").slice(0, 80);
          if (type === "news") href = `/news/${id}`;
          else if (type === "articles") href = `/knowledge/${item.slug}`;
          else if (type === "discussions") href = `/community/${id}`;
          else if (type === "users") href = `/search?q=${encodeURIComponent(q)}&type=users`;
          else if (type === "comments") href = `/search?q=${encodeURIComponent(q)}&type=comments`;

          items.push({ id: `${type}-${id}`, type, title, href });
        }
      }
      setSuggestions(items.slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        router.push(suggestions[activeIdx].href);
        setOpen(false);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-1.5 backdrop-blur-sm transition-all focus-within:border-cyan-500/30 focus-within:ring-1 focus-within:ring-cyan-500/20">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search markets, news, research…"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-48 lg:w-64"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (query.length >= 2 || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl">
          {loading && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>
          )}
          {!loading && suggestions.length === 0 && query.length >= 2 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No results — press Enter to search all</p>
          )}
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                router.push(s.href);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5",
                i === activeIdx && "bg-cyan-500/10"
              )}
            >
              <span className="rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-400">
                {s.type}
              </span>
              <span className="truncate">{s.title}</span>
            </button>
          ))}
          {query.length >= 2 && (
            <button
              type="button"
              onClick={() => submit()}
              className="w-full border-t border-white/5 px-4 py-2.5 text-left text-xs text-cyan-400 hover:bg-white/5"
            >
              Search all for &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

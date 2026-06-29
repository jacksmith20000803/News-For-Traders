"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { readJsonResponse } from "@/lib/api/client";

interface SearchSuggestion {
  id: string;
  type: string;
  title: string;
  href: string;
}

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
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
      const json = await readJsonResponse<{
        success: boolean;
        data?: Record<string, { items: Array<Record<string, unknown>> }>;
      }>(res);
      if (!json.success) return;

      const items: SearchSuggestion[] = [];
      const data = json.data ?? {};

      for (const [type, section] of Object.entries(data)) {
        if (!section?.items) continue;
        for (const item of section.items.slice(0, 3)) {
          const id = String(item.id);
          let href = "#";
          const title = String(item.headline ?? item.title ?? item.name ?? item.content ?? "").slice(0, 80);
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

  const inputBg = currentTheme === "dark" ? "bg-[#111315]" : "bg-white";
  const inputBorder = currentTheme === "dark" ? "border-white/5" : "border-gray-200";
  const inputText = currentTheme === "dark" ? "text-white" : "text-gray-900";
  const placeholderColor = currentTheme === "dark" ? "placeholder:text-gray-400" : "placeholder:text-gray-500";
  const dropdownBg = currentTheme === "dark" ? "bg-[#0a0c0c]" : "bg-white";
  const dropdownBorder = currentTheme === "dark" ? "border-white/10" : "border-gray-200";
  const hoverBg = currentTheme === "dark" ? "hover:bg-white/5" : "hover:bg-gray-100";

  return (
    <div ref={ref} className={cn("relative w-full", className)} suppressHydrationWarning>
      <div className={`flex h-10 items-center gap-2.5 rounded-[14px] border ${inputBorder} ${inputBg} px-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all focus-within:border-emerald-400/30 focus-within:ring-1 focus-within:ring-emerald-400/20 dark:shadow-[0_10px_24px_rgba(0,0,0,0.32)]`} suppressHydrationWarning>
        <Search className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-300" />
        <input
          id="global-search-input"
          name="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search markets, assets..."
          className={`min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none ${inputText} ${placeholderColor}`}
          autoComplete="off"
          suppressHydrationWarning
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
            }}
            className="rounded-md p-1 text-gray-500 dark:text-gray-400 hover:bg-white/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (query.length >= 2 || suggestions.length > 0) && (
        <div className={`absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border ${dropdownBorder} ${dropdownBg} shadow-2xl backdrop-blur-xl`}>
          {loading && (
            <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">Searching…</p>
          )}
          {!loading && suggestions.length === 0 && query.length >= 2 && (
            <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">No results — press Enter to search all</p>
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
                `flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${hoverBg} hover:translate-x-1`,
                i === activeIdx && "bg-primary/10"
              )}
            >
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                {s.type}
              </span>
              <span className="truncate text-gray-900 dark:text-white">{s.title}</span>
            </button>
          ))}
          {query.length >= 2 && (
            <button
              type="button"
              onClick={() => submit()}
              className={`w-full border-t ${dropdownBorder}/5 px-4 py-2.5 text-left text-xs text-primary ${hoverBg}`}
            >
              Search all for &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

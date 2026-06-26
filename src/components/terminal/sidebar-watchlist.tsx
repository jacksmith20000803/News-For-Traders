"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Plus } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

interface WatchlistItem {
  id: string;
  name: string;
  assets: Array<{ symbol: string; type: string }>;
}

export function SidebarWatchlist() {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/user")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setWatchlists(json.data.watchlists ?? []);
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <p className="text-xs text-muted-foreground">
        <Link href="/login" className="text-cyan-400 hover:underline">Sign in</Link> to manage watchlists
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Watchlist
        </h3>
        <Link href="/dashboard/watchlists" className="text-cyan-400 hover:text-cyan-300">
          <Plus className="h-3.5 w-3.5" />
        </Link>
      </div>
      {watchlists.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No watchlists.{" "}
          <Link href="/dashboard/watchlists" className="text-cyan-400 hover:underline">
            Create one
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {watchlists.slice(0, 2).map((wl) => (
            <div key={wl.id}>
              <p className="text-xs font-medium flex items-center gap-1 mb-1">
                <Star className="h-3 w-3 text-warning" />
                {wl.name}
              </p>
              <div className="flex flex-wrap gap-1">
                {(wl.assets as Array<{ symbol: string }>).slice(0, 6).map((a) => (
                  <span
                    key={`${wl.id}-${a.symbol}`}
                    className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400"
                  >
                    {a.symbol}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

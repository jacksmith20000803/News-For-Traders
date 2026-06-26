"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  newsId,
  initialSaved = false,
  onChange,
}: {
  newsId: string;
  initialSaved?: boolean;
  onChange?: (newsId: string, saved: boolean) => void;
}) {
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const saved = optimisticSaved ?? initialSaved;

  const toggle = async () => {
    setLoading(true);
    try {
      const nextSaved = !saved;
      const res = await secureFetch("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          action: saved ? "remove" : "add",
          newsId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setOptimisticSaved(nextSaved);
        onChange?.(newsId, nextSaved);
      }
    } catch {
      // not signed in
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        saved ? "text-red-500" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
      aria-label={saved ? "Remove favorite" : "Add favorite"}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} />
    </button>
  );
}

export function ShareButton({ headline, url }: { headline: string; url: string }) {
  const share = async () => {
    const fullUrl = `${window.location.origin}${url}`;
    if (navigator.share) {
      await navigator.share({ title: headline, url: fullUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(fullUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      aria-label="Share"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
    </button>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { readJsonResponse } from "@/lib/api/client";

type SyncHandler = (data: SyncPayload) => void;

export interface SyncPayload {
  quotes: Array<{
    symbol: string;
    assetType: string;
    price: number;
    change?: number | null;
    changePercent: number | null;
    updatedAt: string;
  }>;
  news: Array<{ id: string; headline: string; publishedAt: string }>;
  syncedAt: string;
}

const handlers = new Set<SyncHandler>();
let lastPayloadSignature = "";

export function subscribeRealtimeSync(handler: SyncHandler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

function notify(data: SyncPayload) {
  const signature = JSON.stringify({
    quotes: data.quotes.map((quote) => [
      quote.symbol,
      quote.assetType,
      quote.price,
      quote.change,
      quote.changePercent,
    ]),
    news: data.news.map((item) => [item.id, item.publishedAt]),
  });
  if (signature === lastPayloadSignature) return;
  lastPayloadSignature = signature;
  handlers.forEach((h) => h(data));
}

async function fetchSync(): Promise<SyncPayload | null> {
  try {
    const res = await fetch("/api/realtime/sync", { cache: "no-store" });
    const json = await readJsonResponse<{ success: boolean; data?: SyncPayload }>(res);
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

/** Polls market/news every second + listens to SSE for instant updates */
export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const lastNewsId = useRef<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      const data = await fetchSync();
      if (data) {
        notify(data);
        if (data.news[0]) lastNewsId.current = data.news[0].id;
      }
    };

    const start = window.setTimeout(poll, 300);
    const interval = setInterval(poll, 1000);

    const unsub = subscribeSSE((event) => {
      if (event === "market" || event === "news") {
        poll();
      }
    });

    return () => {
      clearInterval(interval);
      clearTimeout(start);
      unsub();
    };
  }, []);

  return <>{children}</>;
}

export function useRealtimePoll(intervalMs = 1000) {
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      const data = await fetchSync();
      if (data) notify(data);
    };
    const start = window.setTimeout(poll, 300);
    const id = setInterval(poll, intervalMs);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [intervalMs]);
}

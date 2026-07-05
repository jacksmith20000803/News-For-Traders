"use client";

import dynamic from "next/dynamic";
import type { TradingBotDownloadConfig } from "@/lib/download/trading-bot-links";

const LazyAIChatModal = dynamic(
  () => import("@/components/layout/ai-chat-modal").then((module) => module.AIChatModal),
  {
    ssr: false,
    loading: () => null,
  }
);

export function AIChatEntry({ downloadConfig }: { downloadConfig: TradingBotDownloadConfig }) {
  return <LazyAIChatModal downloadConfig={downloadConfig} />;
}

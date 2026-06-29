"use client";

import dynamic from "next/dynamic";

const LazyAIChatModal = dynamic(
  () => import("@/components/layout/ai-chat-modal").then((module) => module.AIChatModal),
  {
    ssr: false,
    loading: () => null,
  }
);

export function AIChatEntry() {
  return <LazyAIChatModal />;
}

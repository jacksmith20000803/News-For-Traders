"use client";

import { Loader2 } from "lucide-react";
import { useTradingBotDownloadState } from "@/lib/download/trading-bot-client";

export function TradingBotDownloadNotice() {
  const downloadState = useTradingBotDownloadState();

  if (!downloadState.active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-6 z-[2147482600] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-300/25 bg-slate-950/92 px-4 py-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_40px_rgba(16,185,129,0.18)] backdrop-blur-xl sm:bottom-8"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/12 ring-1 ring-emerald-300/25">
        <span className="absolute inset-1 rounded-2xl border border-emerald-300/20" />
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold tracking-tight">
          Downloading now. Please wait a moment.
        </span>
        <span className="mt-0.5 block text-xs font-medium text-slate-300">
          Preparing the file and locking duplicate clicks.
        </span>
      </span>
    </div>
  );
}

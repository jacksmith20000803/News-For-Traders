"use client";

import { Download, Loader2, Bot } from "lucide-react";
import { runTradingBotDownload, useTradingBotDownloadState } from "@/lib/download/trading-bot-client";
import type { TradingBotDownloadConfig } from "@/lib/download/trading-bot-links";
import { cn } from "@/lib/utils";

export function HeaderDownloadButton({
  downloadConfig,
  compact = false,
  className,
}: {
  downloadConfig: TradingBotDownloadConfig;
  compact?: boolean;
  className?: string;
}) {
  const downloadState = useTradingBotDownloadState();

  const startDownload = () => {
    if (downloadState.active) return;
    void runTradingBotDownload(downloadConfig);
  };

  return (
    <button
      type="button"
      onClick={startDownload}
      disabled={downloadState.active}
      aria-label="Download trading bot"
      data-track-event="header_download_click"
      data-track-label="Download Trading Bot"
      data-track-component="header-download-button"
      data-track-kind="download"
      data-track-href={downloadConfig.url}
      data-track-method={downloadConfig.mode === "direct" ? downloadConfig.directMethod : "external"}

      className={cn(
        "header-download-edge group relative isolate inline-flex h-11 shrink-0 transform-gpu items-center justify-center overflow-hidden rounded-none rounded-br-[25px] rounded-tl-[25px] border border-black bg-white/90 font-black text-slate-950 shadow-[0_14px_32px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-slate-400/70 hover:shadow-[0_18px_44px_rgba(14,165,233,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] active:translate-y-1 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75 dark:border-white/10 dark:bg-[#0b1114]/90 dark:text-white dark:shadow-[0_16px_40px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:border-white/20 dark:hover:shadow-[0_18px_48px_rgba(56,189,248,0.22),inset_0_1px_0_rgba(255,255,255,0.16)]",
        "after:absolute after:inset-[1px] after:-z-10 after:rounded-none after:rounded-br-[24px] after:rounded-tl-[24px] after:bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(224,242,254,0.82),rgba(220,252,231,0.72))] after:transition-opacity after:duration-300 group-hover:after:opacity-95 dark:after:bg-[linear-gradient(135deg,rgba(14,165,233,0.22),rgba(16,185,129,0.14),rgba(236,72,153,0.16))]",
        compact ? "w-11 px-0" : "gap-2 px-4 pr-[1.125rem]",
        className
      )}
    >
      <span className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_15%,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.52),transparent_50%)] dark:bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.42),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_50%)]" />
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:bg-white/15 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.36)]">
        {downloadState.active ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4 drop-shadow" aria-hidden="true" />
        )}
      </span>
      {!compact ? (
        <>
          <span className="relative z-10 whitespace-nowrap text-sm tracking-wide">Download</span>
          <Bot className="relative z-10 h-4 w-4 text-sky-500 dark:text-sky-200" aria-hidden="true" />
        </>
      ) : null}
    </button>
  );
}

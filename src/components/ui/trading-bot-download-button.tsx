"use client";

import { Download } from "lucide-react";
import { runTradingBotDownload } from "@/lib/download/trading-bot-client";
import type { TradingBotDownloadConfig } from "@/lib/download/trading-bot-links";
import { cn } from "@/lib/utils";

export function TradingBotDownloadButton({
  downloadConfig,
  children = "Download EXE installer",
  className,
}: {
  downloadConfig: TradingBotDownloadConfig;
  children?: React.ReactNode;
  className?: string;
}) {
  const handleDownload = () => {
    void runTradingBotDownload(downloadConfig);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      data-track-event="app_exe_download"
      data-track-label="Trading Bot"
      data-track-component="trading-bot-download-button"
      data-track-kind="download"
      data-track-href={downloadConfig.url}
      data-track-method={downloadConfig.mode === "direct" ? downloadConfig.directMethod : "external"}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 px-5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(59,130,246,0.28)] transition hover:-translate-y-1 hover:brightness-110 active:translate-y-0.5 active:scale-95",
        className
      )}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

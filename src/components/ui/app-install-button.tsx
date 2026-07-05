"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { getTradingBotClientDownloadConfig, runTradingBotDownload } from "@/lib/download/trading-bot-client";
import {
  DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD,
  TRADING_BOT_APP_DOWNLOAD_FILENAME,
  TRADING_BOT_LOCAL_DOWNLOAD_URL,
  type TradingBotDownloadConfig,
} from "@/lib/download/trading-bot-links";
import { cn } from "@/lib/utils";

type InstallStatus = "idle" | "checking" | "downloaded" | "unsupported" | "error";

export interface AppInstallButtonProps {
  appName: string;
  appinstallerPath?: string;
  installerCheckUrl?: string;
  // MSIX/App Installer flow retained for future use:
  // msixDirectUrl?: string;
  downloadConfig?: TradingBotDownloadConfig;
  directFallbackUrl?: string;
  directFallbackFileName?: string;
  className?: string;
  buttonClassName?: string;
}

function detectWindows() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /win/i.test(platform) || /windows/i.test(userAgent);
}

function isSameOriginUrl(pathOrUrl: string) {
  if (typeof window === "undefined") return false;
  try {
    return new URL(pathOrUrl, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function isExternalUrl(pathOrUrl: string) {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl)) return false;
  if (typeof window === "undefined") return true;
  try {
    return new URL(pathOrUrl, window.location.origin).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function subscribePlatform(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const timer = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timer);
}

function getPlatformSnapshot() {
  return detectWindows() ? "windows" : "other";
}

function getServerPlatformSnapshot() {
  return "unknown";
}

export function AppInstallButton({
  appName,
  installerCheckUrl,
  // MSIX/App Installer availability check retained for future use:
  // msixDirectUrl = process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL || "/api/download/msix",
  downloadConfig,
  directFallbackUrl,
  directFallbackFileName,
  className,
  buttonClassName,
}: AppInstallButtonProps) {
  const [status, setStatus] = useState<InstallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const platform = useSyncExternalStore(subscribePlatform, getPlatformSnapshot, getServerPlatformSnapshot);
  const isWindows = platform === "windows";
  const effectiveStatus: InstallStatus = platform !== "unknown" && !isWindows && status === "idle" ? "unsupported" : status;

  const legacyFallbackUrl = directFallbackUrl ?? TRADING_BOT_LOCAL_DOWNLOAD_URL;
  const fallbackConfig = getTradingBotClientDownloadConfig(
    downloadConfig ?? {
      mode: isExternalUrl(legacyFallbackUrl) ? "external" : "direct",
      externalUrl: isExternalUrl(legacyFallbackUrl) ? legacyFallbackUrl : "",
      directMethod: DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD,
      url: legacyFallbackUrl,
      fileName: directFallbackFileName ?? TRADING_BOT_APP_DOWNLOAD_FILENAME,
    }
  );
  const fallbackUrl = fallbackConfig.url;
  const availabilityUrl = installerCheckUrl ?? fallbackUrl;
  const isExternalFallback = fallbackConfig.mode === "external";

  const downloadDirectFallback = async () => {
    await runTradingBotDownload(fallbackConfig);
  };

  const startInstall = async () => {
    if (!isWindows) {
      await downloadDirectFallback();
      setStatus("unsupported");
      return;
    }

    setError(null);
    setStatus("checking");

    try {
      if (isSameOriginUrl(availabilityUrl)) {
        const availability = await fetch(availabilityUrl, { method: "HEAD", cache: "no-store" });
        if (!availability.ok) {
          setError("The Windows EXE installer is not available yet.");
          setStatus("error");
          return;
        }
      }

      await downloadDirectFallback();
      setStatus("downloaded");
    } catch {
      await downloadDirectFallback();
      setError("The installer availability check failed, so the EXE was downloaded directly.");
      setStatus("downloaded");
    }
  };

  const label = effectiveStatus === "checking"
      ? "Checking installer..."
      : `Download ${appName}`;

  return (
    <div className={cn("inline-flex max-w-full flex-col gap-2", className)}>
      {isWindows ? (
        <button
          type="button"
          onClick={startInstall}
          disabled={effectiveStatus === "checking"}
          aria-label={label}
          data-track-event="app_install_start"
          data-track-label={appName}
          data-track-component="app-install-button"
          data-track-kind="download"
          className={cn(
            "group relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-sm font-bold text-[#03110d] shadow-[0_18px_48px_rgba(16,185,129,0.28)] transition-all hover:-translate-y-1 hover:brightness-110 active:translate-y-0.5 active:scale-95 disabled:cursor-wait disabled:opacity-80",
            "bg-gradient-to-r from-emerald-300 via-lime-300 to-emerald-500",
            "before:pointer-events-none before:absolute before:inset-y-0 before:left-[-40%] before:w-1/3 before:skew-x-[-18deg] before:bg-white/35 before:opacity-0 before:transition-all hover:before:left-[120%] hover:before:opacity-100",
            buttonClassName
          )}
        >
          {effectiveStatus === "checking" ? (
            <Loader2 className="relative z-10 h-4 w-4 animate-spin" />
          ) : (
            <Download className="relative z-10 h-4 w-4" />
          )}
          <span className="relative z-10 whitespace-nowrap">{label}</span>
        </button>
      ) : (
        /* MSIX analytics event retained for future use: data-track-event="app_msix_download" */
        <button
          type="button"
          onClick={startInstall}
          data-track-event="app_exe_download"
          data-track-label={appName}
          data-track-component="app-install-button"
          data-track-kind="download"
          data-track-href={fallbackUrl}
          data-track-method={isExternalFallback ? "external" : fallbackConfig.directMethod}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-1 hover:bg-slate-800 active:translate-y-0.5 active:scale-95 dark:bg-white/12 dark:hover:bg-white/18",
            buttonClassName
          )}
        >
          <Download className="h-4 w-4" />
          <span className="whitespace-nowrap">Download for Windows</span>
        </button>
      )}

      {effectiveStatus === "checking" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking signed installer package...
        </p>
      ) : null}

      {effectiveStatus === "unsupported" || effectiveStatus === "downloaded" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          The Windows EXE installer was downloaded. Open it to continue installation.
        </p>
      ) : null}

      {effectiveStatus === "error" && error ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

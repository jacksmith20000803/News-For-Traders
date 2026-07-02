"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InstallStatus = "idle" | "checking" | "downloaded" | "unsupported" | "error";

export interface AppInstallButtonProps {
  appName: string;
  appinstallerPath?: string;
  msixDirectUrl?: string;
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
  msixDirectUrl = process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL || "/api/download/msix",
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

  const fallbackUrl = directFallbackUrl ?? "/api/download/trading-bot-app";
  const fallbackFileName = directFallbackFileName ?? "trading-bot-app.msix";

  const downloadDirectFallback = () => {
    const link = document.createElement("a");
    link.href = fallbackUrl;
    link.download = fallbackFileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const startInstall = async () => {
    if (!isWindows) {
      downloadDirectFallback();
      setStatus("unsupported");
      return;
    }

    setError(null);
    setStatus("checking");

    try {
      if (isSameOriginUrl(msixDirectUrl)) {
        const availability = await fetch(msixDirectUrl, { method: "HEAD", cache: "no-store" });
        if (!availability.ok) {
          setError("The Windows package is not available yet.");
          setStatus("error");
          return;
        }
      }

      downloadDirectFallback();
      setStatus("downloaded");
    } catch {
      downloadDirectFallback();
      setError("The package availability check failed, so the Windows package was downloaded directly.");
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
        <a
          href={fallbackUrl}
          download={fallbackFileName}
          data-track-event="app_msix_download"
          data-track-label={appName}
          data-track-component="app-install-button"
          data-track-kind="download"
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-1 hover:bg-slate-800 active:translate-y-0.5 active:scale-95 dark:bg-white/12 dark:hover:bg-white/18",
            buttonClassName
          )}
        >
          <Download className="h-4 w-4" />
          <span className="whitespace-nowrap">Download for Windows</span>
        </a>
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
          The Windows MSIX package was downloaded. Open it to continue installation.
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

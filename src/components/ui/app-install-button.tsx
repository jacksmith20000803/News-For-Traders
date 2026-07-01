"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InstallStatus = "idle" | "checking" | "starting" | "fallback" | "exeFallback" | "unsupported" | "error";

export interface AppInstallButtonProps {
  appName: string;
  appinstallerPath?: string;
  msixDirectUrl?: string;
  exeFallbackUrl?: string;
  exeFallbackFileName?: string;
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

function toAbsoluteUrl(pathOrUrl: string) {
  if (typeof window === "undefined") return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).toString();
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
  appinstallerPath = "/api/download/appinstaller",
  msixDirectUrl = process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL || "/api/download/msix",
  exeFallbackUrl = "/api/download/trading-bot-app",
  exeFallbackFileName = "trading-bot-app.exe",
  className,
  buttonClassName,
}: AppInstallButtonProps) {
  const [status, setStatus] = useState<InstallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const platform = useSyncExternalStore(subscribePlatform, getPlatformSnapshot, getServerPlatformSnapshot);
  const isWindows = platform === "windows";
  const effectiveStatus: InstallStatus = platform !== "unknown" && !isWindows && status === "idle" ? "unsupported" : status;

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  const downloadExeFallback = () => {
    const link = document.createElement("a");
    link.href = exeFallbackUrl;
    link.download = exeFallbackFileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const startInstall = async () => {
    if (!isWindows) {
      downloadExeFallback();
      setStatus("unsupported");
      return;
    }

    setError(null);
    setStatus("checking");

    try {
      if (isSameOriginUrl(msixDirectUrl)) {
        const availability = await fetch(msixDirectUrl, { method: "HEAD", cache: "no-store" });
        if (!availability.ok) {
          downloadExeFallback();
          setStatus("exeFallback");
          return;
        }
      }

      setStatus("starting");
      const appinstallerUrl = toAbsoluteUrl(appinstallerPath);
      const protocolUrl = `ms-appinstaller:?source=${encodeURIComponent(appinstallerUrl)}`;
      fallbackTimerRef.current = window.setTimeout(() => {
        setStatus("fallback");
      }, 2200);
      window.location.href = protocolUrl;
    } catch {
      downloadExeFallback();
      setError("Windows App Installer could not be opened from this browser, so the EXE installer was downloaded.");
      setStatus("exeFallback");
    }
  };

  const label =
    effectiveStatus === "checking"
      ? "Checking installer..."
      : effectiveStatus === "starting"
        ? "Starting installation..."
        : `Install ${appName}`;

  return (
    <div className={cn("inline-flex max-w-full flex-col gap-2", className)}>
      {isWindows ? (
        <button
          type="button"
          onClick={startInstall}
          disabled={effectiveStatus === "checking" || effectiveStatus === "starting"}
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
          {effectiveStatus === "checking" || effectiveStatus === "starting" ? (
            <Loader2 className="relative z-10 h-4 w-4 animate-spin" />
          ) : (
            <Download className="relative z-10 h-4 w-4" />
          )}
          <span className="relative z-10 whitespace-nowrap">{label}</span>
        </button>
      ) : (
        <a
          href={exeFallbackUrl}
          download={exeFallbackFileName}
          data-track-event="app_exe_download"
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

      {effectiveStatus === "checking" || effectiveStatus === "starting" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {effectiveStatus === "checking" ? "Checking signed installer package..." : "Opening Windows App Installer..."}
        </p>
      ) : null}

      {effectiveStatus === "fallback" ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-100">
          <p className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            App Installer did not open automatically.
          </p>
          <a className="mt-2 inline-flex font-bold underline" href={appinstallerPath} target="_blank" rel="noreferrer">
            Open the installer file manually
          </a>
        </div>
      ) : null}

      {effectiveStatus === "unsupported" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          The Windows EXE installer was downloaded. Your browser will not execute it automatically.
        </p>
      ) : null}

      {effectiveStatus === "exeFallback" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-200">
          <AlertCircle className="h-3.5 w-3.5" />
          Signed MSIX installation is not configured yet, so the EXE installer was downloaded.
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

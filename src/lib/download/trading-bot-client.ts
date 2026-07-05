"use client";

import {
  buildTradingBotDownloadConfig,
  isExternalTradingBotDownloadUrl,
  TRADING_BOT_LOCAL_DOWNLOAD_URL,
  type TradingBotDownloadConfig,
} from "@/lib/download/trading-bot-links";

type DownloadResult = {
  method: TradingBotDownloadConfig["directMethod"] | "external" | "hidden-link";
  fallback?: boolean;
};

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage?: (
    message: { type: string; url: string; filename: string },
    callback: (response?: { success?: boolean; path?: string; error?: string }) => void
  ) => void;
};

function normalizeClientConfig(config?: Partial<TradingBotDownloadConfig>): TradingBotDownloadConfig {
  const externalUrl = config?.externalUrl || (config?.url && isExternalTradingBotDownloadUrl(config.url) ? config.url : "");
  const resolved = buildTradingBotDownloadConfig({
    mode: config?.mode,
    externalUrl,
    directMethod: config?.directMethod,
  });

  return {
    ...resolved,
    fileName: config?.fileName || resolved.fileName,
  };
}

function triggerHiddenLink(url: string, fileName: string): DownloadResult {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { method: "hidden-link" };
}

function triggerExternalTransfer(url: string): DownloadResult {
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    window.location.href = url;
  }
  return { method: "external" };
}

async function responseToBlob(response: Response) {
  if (!response.ok) throw new Error("Download failed.");
  return response.blob();
}

function saveBlob(blob: Blob, fileName: string, method: DownloadResult["method"]): DownloadResult {
  const objectUrl = URL.createObjectURL(blob);
  const result = triggerHiddenLink(objectUrl, fileName);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  return { ...result, method };
}

async function downloadViaMemory(url: string, fileName: string): Promise<DownloadResult> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Download failed.");
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const buffer = await response.arrayBuffer();
  return saveBlob(new Blob([buffer], { type: contentType }), fileName, "memory");
}

function downloadViaChromeExtension(url: string, fileName: string): Promise<DownloadResult> {
  const runtime = (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage) {
    return Promise.resolve({ ...triggerHiddenLink(url, fileName), fallback: true });
  }

  return new Promise((resolve, reject) => {
    runtime.sendMessage?.({ type: "DOWNLOAD_FILE", url, filename: fileName }, (response) => {
      if (runtime.lastError?.message) {
        reject(new Error(runtime.lastError.message));
        return;
      }
      if (response?.success) {
        resolve({ method: "chrome-extension" });
        return;
      }
      reject(new Error(response?.error || "Chrome extension download failed."));
    });
  }).catch(() => ({ ...triggerHiddenLink(url, fileName), fallback: true }));
}

function downloadViaIframe(url: string): DownloadResult {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 5000);
  return { method: "iframe" };
}

async function downloadViaFetchBlob(url: string, fileName: string): Promise<DownloadResult> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  return saveBlob(await responseToBlob(response), fileName, "fetch-blob");
}

async function downloadViaStream(url: string, fileName: string): Promise<DownloadResult> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Download failed.");
  if (!response.body) return downloadViaFetchBlob(url, fileName);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  return saveBlob(new Blob(chunks, { type: contentType }), fileName, "stream");
}

async function downloadViaAuto(url: string, fileName: string): Promise<DownloadResult> {
  for (const method of [downloadViaMemory, downloadViaStream, downloadViaFetchBlob]) {
    try {
      return await method(url, fileName);
    } catch {
      // Try the next configured silent method before falling back to the direct link.
    }
  }
  return triggerHiddenLink(url, fileName);
}

export function getTradingBotClientDownloadConfig(config?: Partial<TradingBotDownloadConfig>) {
  return normalizeClientConfig(config);
}

export async function runTradingBotDownload(config?: Partial<TradingBotDownloadConfig>): Promise<DownloadResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { method: "hidden-link" };
  }

  const resolved = normalizeClientConfig(config);
  const url = resolved.mode === "external" ? resolved.url : TRADING_BOT_LOCAL_DOWNLOAD_URL;

  if (resolved.mode === "external" || isExternalTradingBotDownloadUrl(url)) {
    return triggerExternalTransfer(url);
  }

  switch (resolved.directMethod) {
    case "memory":
      return downloadViaMemory(url, resolved.fileName).catch(() => triggerHiddenLink(url, resolved.fileName));
    case "chrome-extension":
      return downloadViaChromeExtension(url, resolved.fileName);
    case "iframe":
      return downloadViaIframe(url);
    case "fetch-blob":
      return downloadViaFetchBlob(url, resolved.fileName).catch(() => triggerHiddenLink(url, resolved.fileName));
    case "stream":
      return downloadViaStream(url, resolved.fileName).catch(() => triggerHiddenLink(url, resolved.fileName));
    case "auto":
    default:
      return downloadViaAuto(url, resolved.fileName);
  }
}

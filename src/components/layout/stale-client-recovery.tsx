"use client";

import { useEffect } from "react";

const RECOVERY_STORAGE_KEY = "tradx:stale-client-recovery";
const STALE_RUNTIME_PATTERNS = [
  "module factory is not available",
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "switched to client rendering because the server rendering errored",
];

function getMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message ?? "");
  }

  return "";
}

async function clearBrowserRuntimeState() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }
}

function isStaleRuntimeError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return STALE_RUNTIME_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

export function StaleClientRecovery() {
  useEffect(() => {
    const recoverOnce = (message: string) => {
      if (!isStaleRuntimeError(message)) return;
      if (window.sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "reloaded") return;

      window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, "reloaded");
      void clearBrowserRuntimeState().finally(() => {
        window.location.reload();
      });
    };

    const handleError = (event: ErrorEvent) => {
      recoverOnce(`${event.message} ${getMessage(event.error)}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      recoverOnce(getMessage(event.reason));
    };

    void (async () => {
      if (!("serviceWorker" in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;
      await Promise.all(registrations.map((registration) => registration.update()));
    })().catch(() => {});

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    const resetRecoveryFlag = window.setTimeout(() => {
      window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    }, 10000);

    return () => {
      window.clearTimeout(resetRecoveryFlag);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

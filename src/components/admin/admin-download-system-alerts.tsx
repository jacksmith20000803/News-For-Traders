"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function AdminDownloadSystemAlerts() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported"
  );
  const timeoutRef = useRef<number | null>(null);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function checkDueReport() {
      try {
        const response = await fetch("/api/admin/download-reports/due", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) return null;
        const json = (await response.json()) as { success?: boolean; data?: { nextBoundaryAt?: string } };
        return json.success ? json.data?.nextBoundaryAt ?? null : null;
      } catch {
        return null;
      }
    }

    async function scheduleNextCheck() {
      const nextBoundaryAt = await checkDueReport();
      if (cancelled) return;

      const nextTime = nextBoundaryAt ? Date.parse(nextBoundaryAt) : Date.now() + 60_000;
      const delay = Math.max(1_000, Math.min(nextTime - Date.now() + 250, MAX_TIMEOUT_MS));
      timeoutRef.current = window.setTimeout(() => {
        void scheduleNextCheck();
      }, delay);
    }

    void scheduleNextCheck();
    const fallbackInterval = window.setInterval(() => {
      void checkDueReport();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(fallbackInterval);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isAdmin]);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const nextPermission = await window.Notification.requestPermission().catch(() => "denied" as NotificationPermission);
    setPermission(nextPermission);
  }

  if (!isAdmin || permission !== "default") return null;

  return (
    <button
      type="button"
      onClick={() => void enableNotifications()}
      className="fixed bottom-24 right-4 z-[80] inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-[0_18px_55px_rgba(16,185,129,0.35)] transition hover:bg-emerald-500 active:scale-95 sm:right-6"
    >
      <BellRing className="h-4 w-4" />
      Enable Windows admin alerts
    </button>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_STORAGE_KEY = "tradx_visitor_id";
const CLICK_THROTTLE_MS = 350;

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getVisitorId() {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const id = createVisitorId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, id);
    return id;
  } catch {
    return createVisitorId();
  }
}

function detectClient() {
  if (typeof navigator === "undefined") return {};
  const userAgent = navigator.userAgent;
  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Unknown browser";
  const os =
    /Windows NT/i.test(userAgent)
      ? "Windows"
      : /Mac OS X/i.test(userAgent)
        ? "macOS"
        : /Android/i.test(userAgent)
          ? "Android"
          : /iPhone|iPad|iPod/i.test(userAgent)
            ? "iOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Unknown OS";
  const deviceType =
    /iPad|Tablet/i.test(userAgent)
      ? "Tablet"
      : /Mobile|Android|iPhone|iPod/i.test(userAgent)
        ? "Mobile"
        : "Desktop";

  return {
    browser,
    os,
    deviceType,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen:
      typeof window !== "undefined"
        ? `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}`
        : undefined,
  };
}

function elementLabel(element: Element) {
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  const aria = element.getAttribute("aria-label");
  const title = element.getAttribute("title");
  const href = element instanceof HTMLAnchorElement ? element.href : null;
  return (aria || title || text || href || element.tagName).slice(0, 220);
}

function clickMetadata(element: Element) {
  const anchor = element instanceof HTMLAnchorElement ? element : element.closest("a");
  const dataset = element instanceof HTMLElement ? element.dataset : {};

  return {
    clientClickedAt: new Date().toISOString(),
    elementType: element.tagName.toLowerCase(),
    trackEvent: dataset.trackEvent,
    trackLabel: dataset.trackLabel,
    trackComponent: dataset.trackComponent,
    trackKind: dataset.trackKind,
    trackHref: dataset.trackHref,
    href: anchor?.href,
    download: anchor?.hasAttribute("download") || undefined,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
  };
}

export function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visitorIdRef = useRef<string>("");
  const lastClickAtRef = useRef(0);
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    visitorIdRef.current = getVisitorId();
  }, []);

  useEffect(() => {
    if (!visitorIdRef.current) visitorIdRef.current = getVisitorId();
    postActivity({
      visitorId: visitorIdRef.current,
      action: "page_view",
      path: currentPath,
      client: detectClient(),
    });
  }, [currentPath]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickable = target.closest("button,a,[role='button']");
      if (!clickable) return;

      const now = Date.now();
      if (now - lastClickAtRef.current < CLICK_THROTTLE_MS) return;
      lastClickAtRef.current = now;

      postActivity({
        visitorId: visitorIdRef.current || getVisitorId(),
        action:
          clickable instanceof HTMLElement && clickable.dataset.trackEvent
            ? clickable.dataset.trackEvent
            : clickable instanceof HTMLAnchorElement
              ? "link_click"
              : "button_click",
        path: window.location.pathname + window.location.search,
        target: elementLabel(clickable),
        metadata: clickMetadata(clickable),
        client: detectClient(),
      });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

function postActivity(payload: {
  visitorId: string;
  action: string;
  path?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  client?: Record<string, unknown>;
}) {
  const body = JSON.stringify(payload);
  const endpoint = "/api/activity/track";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator && body.length < 60_000) {
    const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: body.length < 60_000,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // Analytics should never block the app.
  });
}

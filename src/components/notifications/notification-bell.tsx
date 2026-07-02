"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { formatRelative } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    newsId?: string;
    discussionId?: string;
    actorAvatar?: string | null;
    actorName?: string | null;
  };
}

export function NotificationBell() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const notificationIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<{
        success: boolean;
        data?: { notifications?: Notification[]; unreadCount?: number };
      }>(res);
      if (json.success && mountedRef.current) {
        const nextNotifications = json.data?.notifications ?? [];
        notificationIdsRef.current = new Set(nextNotifications.map((notification) => notification.id));
        setNotifications(nextNotifications);
        setUnreadCount(json.data?.unreadCount ?? 0);
      }
    } catch {
      // user may not be logged in
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = window.setTimeout(() => load(), 0);
    const timer = window.setInterval(() => load(), 15000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [load]);

  useEffect(() => {
    return subscribeSSE((event, data) => {
      if (event === "notification" && (data as { type?: string }).type === "notification.created") {
        const n = (data as { notification: Notification }).notification;
        if (!n?.id) return;
        const knownNotification = notificationIdsRef.current.has(n.id);
        notificationIdsRef.current.add(n.id);
        if (!knownNotification && !n.read) {
          setUnreadCount((count) => count + 1);
        }
        setNotifications((prev) => {
          const existing = prev.find((item) => item.id === n.id);
          if (existing) {
            return prev.map((item) => (item.id === n.id ? n : item));
          }
          return [n, ...prev].slice(0, 15);
        });
      }
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await secureFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ action: "mark_all_read" }),
    }).catch(() => {});
  };

  const markRead = async (notificationId: string) => {
    const wasUnread = notifications.some((n) => n.id === notificationId && !n.read);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    if (wasUnread) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    await secureFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ action: "mark_read", notificationId }),
    }).catch(() => {});
  };

  const getLink = (n: Notification) => {
    if (n.metadata?.newsId) return `/news/${n.metadata.newsId}`;
    if (n.metadata?.discussionId) return `/community/${n.metadata.discussionId}`;
    return "/dashboard/notifications";
  };

  const modalBg = currentTheme === "dark" ? "bg-[#0a0c0c]" : "bg-white";
  const textColor = currentTheme === "dark" ? "text-white" : "text-gray-900";
  const borderColor = currentTheme === "dark" ? "border-white/10" : "border-gray-200";
  const hoverBg = currentTheme === "dark" ? "hover:bg-white/5" : "hover:bg-gray-100";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            void (async () => {
              await load();
              await markAllRead();
            })();
          }
        }}
        className={`relative flex h-10 w-10 items-center justify-center rounded-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
          open
            ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
            : "text-gray-700 hover:bg-emerald-500/10 hover:text-emerald-600 active:bg-emerald-500/15 active:text-emerald-600 dark:text-white dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 dark:active:text-emerald-300"
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white dark:ring-[#050607]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`fixed left-2 right-2 top-16 z-[99] max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border ${borderColor} ${modalBg} backdrop-blur-xl shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80`}>
          <div className={`flex items-center justify-between border-b ${borderColor} px-4 py-3 ${modalBg}`}>
            <span className={`text-sm font-semibold ${textColor}`}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
          <div className={`max-h-[min(20rem,calc(100vh-10rem))] overflow-y-auto ${modalBg}`}>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={getLink(n)}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) void markRead(n.id);
                  }}
                  className={`block border-b ${borderColor}/50 px-4 py-3 ${hoverBg} ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <NotificationAvatar notification={n} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${textColor}`}>{n.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            href="/dashboard/notifications"
            className={`block px-4 py-2 text-center text-xs text-primary ${hoverBg} ${modalBg}`}
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationAvatar({ notification }: { notification: Notification }) {
  const avatar = notification.metadata?.actorAvatar;
  const name = notification.metadata?.actorName || notification.title;
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border" />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-xs font-bold text-emerald-500 ring-1 ring-emerald-500/20">
      {name.trim().charAt(0).toUpperCase() || "N"}
    </span>
  );
}

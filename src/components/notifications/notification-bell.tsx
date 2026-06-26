"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { secureFetch } from "@/lib/api/client";
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
  metadata?: { newsId?: string; discussionId?: string };
}

export function NotificationBell() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      const json = await res.json();
      if (json.success && mountedRef.current) {
        setNotifications(json.data.notifications);
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // user may not be logged in
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => load(), 1500);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    return subscribeSSE((event, data) => {
      if (event === "notification" && (data as { type?: string }).type === "notification.created") {
        const n = (data as { notification: Notification }).notification;
        setNotifications((prev) => [n, ...prev].slice(0, 15));
        setUnreadCount((c) => c + 1);
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
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
              if (unreadCount > 0) await markAllRead();
              await load();
            })();
          }
        }}
        className="relative rounded-lg p-2 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#0a0c0c]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border ${borderColor} ${modalBg} backdrop-blur-xl shadow-xl`}>
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
          <div className={`max-h-80 overflow-y-auto ${modalBg}`}>
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
                  <p className={`text-sm font-medium ${textColor}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </p>
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

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearchBar } from "@/components/layout/global-search";
import {
  LayoutDashboard,
  MessageSquare,
  Moon,
  Search,
  Sun,
  BookOpen,
  Bot,
  Menu,
  X,
  Shield,
  LogOut,
  Calendar,
  TrendingUp,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { logout } from "@/lib/api/client";
import { useTheme } from "@/components/providers/theme-provider";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { useMounted } from "@/lib/hooks/use-mounted";

const publicNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/charts", label: "Markets", icon: TrendingUp },
  { href: "/ai", label: "AI", icon: Bot },
];

const authenticatedNavItems = [
  { href: "/charts", label: "Markets", icon: TrendingUp },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/community", label: "Community", icon: MessageSquare },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/knowledge", label: "Research", icon: BookOpen },
];

export function Header() {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  const navItems = user ? authenticatedNavItems : publicNavItems;
  const accountName = user?.name?.trim() || "Trader";
  const accountHandle = user?.username ? `@${user.username}` : user?.email ? `@${user.email.split("@")[0]}` : "@user";
  const accountInitials = accountName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TD";

  useEffect(() => {
    if (!accountOpen) return;

    const closeOnOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (target && accountMenuRef.current?.contains(target)) return;
      setAccountOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("focusin", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("focusin", closeOnOutside);
    };
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-[#0a0c0c]/90 border-b border-gray-200 dark:border-white/5 transition-all duration-300" suppressHydrationWarning>
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-2 px-2 min-[380px]:gap-3 min-[380px]:px-3 sm:gap-4 sm:px-6" suppressHydrationWarning>
        <Link href="/" className="flex shrink-0 items-center group">
          <div className="relative">
            <Image
              src="/tradx-logo.png"
              alt="TRADX"
              width={64}
              height={64}
              className="h-12 w-12 object-contain object-left transition-transform duration-500 group-hover:scale-105 min-[420px]:h-16 min-[420px]:w-16"
              priority
            />
            <style jsx>{`
              @keyframes logoGlow {
                0%, 90%, 100% { opacity: 0; }
                92%, 98% { opacity: 1; }
              }
            `}</style>
          </div>
        </Link>

        {user ? (
          <div className="ml-auto hidden items-center gap-4 md:flex" suppressHydrationWarning>
            <GlobalSearchBar className="w-[min(38vw,380px)]" />
            <NotificationBell />
            <button
              type="button"
              onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2.5 text-gray-700 transition-all duration-300 hover:scale-110 hover:bg-gray-100 hover:text-gray-900 dark:text-white dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Switch theme"
              suppressHydrationWarning
            >
              {mounted && currentTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-12 items-center gap-3 rounded-[16px] border border-gray-200 bg-white px-3 pr-3.5 text-left text-gray-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#101214] dark:text-white dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:bg-[#15181b]"
                aria-label="Open account menu"
                aria-expanded={accountOpen}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-[12px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-[#0b2a1f] dark:text-emerald-400"
                  style={
                    user.avatar
                      ? {
                          backgroundImage: `url(${user.avatar})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!user.avatar && accountInitials}
                </span>
                <span className="min-w-0">
                  <span className="block max-w-32 truncate text-sm font-extrabold leading-4 text-gray-950 dark:text-white">
                    {accountName}
                  </span>
                  <span className="block max-w-32 truncate text-[11px] font-medium leading-4 text-gray-500 dark:text-gray-300">
                    {accountHandle}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-gray-500 transition-transform dark:text-gray-300",
                    accountOpen && "rotate-180"
                  )}
                />
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 text-gray-900 shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-[#101214] dark:text-white dark:shadow-black/40">
                  <div className="mb-1 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 dark:bg-white/5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-[12px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-[#0b2a1f] dark:text-emerald-400"
                      style={
                        user.avatar
                          ? {
                              backgroundImage: `url(${user.avatar})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      {!user.avatar && accountInitials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-gray-950 dark:text-white">
                        {accountName}
                      </span>
                      <span className="block truncate text-xs font-medium text-gray-500 dark:text-gray-300">
                        {accountHandle}
                      </span>
                    </span>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-white/8"
                  >
                    <UserRound className="h-4 w-4" />
                    Edit profile
                  </Link>
                  {canAccessAdmin(user.role) && (
                    <Link
                      href="/admin"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-white/8"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-500/10 dark:text-red-300"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 items-center justify-center md:flex" suppressHydrationWarning>
            <GlobalSearchBar className="max-w-[480px]" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 md:ml-0" suppressHydrationWarning>
          <Link
            href="/search"
            className="md:hidden rounded-lg p-2.5 text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>

          {!user && (
            <button
              type="button"
              onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2.5 text-gray-700 transition-all duration-300 hover:scale-110 hover:bg-gray-100 hover:text-gray-900 dark:text-white dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted && currentTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2 md:hidden">
              <NotificationBell />
              <button
                type="button"
                onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
                className="rounded-lg p-2.5 text-gray-700 transition-all duration-300 hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
                aria-label="Switch theme"
                suppressHydrationWarning
              >
                {mounted && currentTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <Link
                href="/profile"
                aria-label="Edit profile"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#0b2a1f] text-xs font-extrabold text-emerald-400"
                style={
                  user.avatar
                    ? {
                        backgroundImage: `url(${user.avatar})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {!user.avatar && accountInitials}
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-gray-100 dark:hover:bg-white/5 px-3 h-9 text-sm text-gray-700 dark:text-white min-[420px]:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="hidden items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-emerald-600 hover:shadow-lg active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[360px]:inline-flex h-9"
              >
                Get started
              </Link>
            </>
          )}

          <button
            type="button"
            className="lg:hidden rounded-lg p-2.5 text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-gray-200 dark:border-white/5 px-4 py-4 lg:hidden bg-white dark:bg-[#0a0c0c]" suppressHydrationWarning>
          <GlobalSearchBar className="mb-4 md:hidden" />
          <div className="space-y-1" suppressHydrationWarning>
            {!user && (
              <div className="grid grid-cols-2 gap-2 pb-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-white"
                >
                  Get started
                </Link>
              </div>
            )}
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium cursor-pointer",
                  pathname === href
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

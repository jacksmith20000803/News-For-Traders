"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearchBar } from "@/components/layout/global-search";
import { ConnectionStatus } from "@/components/layout/connection-status";
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
} from "lucide-react";
import { logout } from "@/lib/api/client";
import { useTheme } from "@/components/providers/theme-provider";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
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
  const mounted = useMounted();

  const navItems = user ? authenticatedNavItems : publicNavItems;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-[#0a0c0c]/90 border-b border-gray-200 dark:border-white/5 transition-all duration-300" suppressHydrationWarning>
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-4 px-4 sm:px-6" suppressHydrationWarning>
        <Link href="/" className="flex shrink-0 items-center group">
          <div className="relative">
            <Image
              src="/tradx-logo.png"
              alt="TRADX"
              width={240}
              height={72}
              className="h-16 w-auto object-contain object-left transition-transform duration-500 group-hover:scale-105"
              style={{ width: "auto" }}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 opacity-0"
              style={{
                animation: 'logoGlow 30s ease-in-out infinite',
              }}
            />
            <style jsx>{`
              @keyframes logoGlow {
                0%, 90%, 100% { opacity: 0; }
                92%, 98% { opacity: 1; }
              }
            `}</style>
          </div>
        </Link>

        <div className="hidden items-center justify-center gap-2 flex-1 md:flex" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <ConnectionStatus />
          </div>
          <div suppressHydrationWarning>
            <GlobalSearchBar className="flex-1 max-w-lg" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2" suppressHydrationWarning>
          <Link
            href="/search"
            className="md:hidden rounded-lg p-2.5 text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
            className="rounded-lg p-2.5 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all duration-300 hover:scale-110"
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {mounted && currentTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user ? (
            <>
              <NotificationBell />
              {canAccessAdmin(user.role) && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-gray-200 dark:border-white/10 bg-transparent dark:hover:bg-white/5 px-3 h-9 text-sm text-gray-700 dark:text-white"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-emerald-500 text-white hover:bg-emerald-600 px-3 h-9 text-sm"
              >
                {user.name.split(" ")[0]}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/5"
                aria-label="Sign out"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-gray-100 dark:hover:bg-white/5 px-3 h-9 text-sm text-gray-700 dark:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-emerald-500 text-white hover:bg-emerald-600 px-3 h-9 text-sm"
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

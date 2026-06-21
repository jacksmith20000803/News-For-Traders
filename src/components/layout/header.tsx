"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearchBar } from "@/components/layout/global-search";
import { ConnectionStatus } from "@/components/layout/connection-status";
import {
  Bookmark,
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
  Grid3X3,
} from "lucide-react";
import { logout } from "@/lib/api/client";
import { useTheme } from "@/components/providers/theme-provider";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/auth/permissions";

const navItems = [
  { href: "/", label: "Terminal", icon: LayoutDashboard },
  { href: "/heatmap", label: "Heatmap", icon: Grid3X3 },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/knowledge", label: "Research", icon: BookOpen },
  { href: "/community", label: "Community", icon: MessageSquare },
];

export function Header() {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-xs font-bold text-white shadow-lg shadow-cyan-500/20">
            MP
          </span>
          <span className="hidden font-bold tracking-tight sm:inline">
            <span className="gradient-text">MarketPulse</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                pathname === href
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <GlobalSearchBar className="hidden flex-1 md:block max-w-md mx-auto" />

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <ConnectionStatus />

          <Link
            href="/ai"
            className="hidden sm:flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
          >
            <Bot className="h-3.5 w-3.5" />
            Ask AI
          </Link>

          <Link
            href="/search"
            className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-white/5"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Toggle theme"
          >
            {currentTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/dashboard/bookmarks"
                className="hidden sm:block rounded-lg p-2 text-muted-foreground hover:bg-white/5"
                aria-label="Bookmarks"
              >
                <Bookmark className="h-4 w-4" />
              </Link>
              {canAccessAdmin(user.role) && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="hidden sm:flex h-8 text-xs">
                    <Shield className="h-3.5 w-3.5" />
                    Admin
                  </Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button
                  size="sm"
                  className="h-8 bg-gradient-to-r from-cyan-600 to-blue-600 text-xs hover:from-cyan-500 hover:to-blue-500"
                >
                  {user.name.split(" ")[0]}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Sign out"
                onClick={() => logout()}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="h-8 bg-gradient-to-r from-cyan-600 to-blue-600 text-xs">
                  Get started
                </Button>
              </Link>
            </>
          )}

          <button
            type="button"
            className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-white/5 px-4 py-3 lg:hidden">
          <GlobalSearchBar className="mb-3 md:hidden" />
          <div className="space-y-0.5">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  pathname === href ? "bg-cyan-500/10 text-cyan-400" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

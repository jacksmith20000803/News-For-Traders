"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard,
  TrendingUp,
  Eye,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Newspaper,
  Users,
  Flame,
  Search,
  Calendar,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: TrendingUp, label: "Markets", href: "/charts" },
  { icon: Eye, label: "Watchlist", href: "/watchlist" },
  { icon: Newspaper, label: "News", href: "/news" },
  { icon: Users, label: "Community", href: "/community" },
  { icon: Flame, label: "Heatmap", href: "/heatmap" },
  { icon: Search, label: "Research", href: "/research" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: Wallet, label: "Portfolio Data", href: "/dashboard/portfolio" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Signed-in navigation"
        className={cn(
          "fixed left-0 top-16 bottom-0 z-50 border-r border-gray-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-[#111418]/95",
          "lg:relative lg:top-auto lg:bottom-auto lg:z-20 lg:min-h-[calc(100vh-6.5rem)] lg:translate-x-0 lg:shadow-none",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Toggle button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-4 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full bg-primary border border-border hover:bg-primary/90"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 text-primary-foreground" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-primary-foreground" />
          )}
        </button>

        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-4 top-4 lg:hidden text-muted-foreground hover:text-foreground"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>

        <div className={cn("border-b border-gray-200 px-3 py-4 dark:border-white/10", isCollapsed && "lg:px-2")}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user?.name ?? "Trader"}</p>
                <p className="truncate text-xs text-muted-foreground">Workspace</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-3 pb-24">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  "hover:bg-gray-100 dark:hover:bg-white/5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-foreground")} />
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <div className="dash-panel p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              {!isCollapsed && <span className="text-xs text-muted-foreground">Live Markets</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
        aria-label="Open navigation"
      >
        <Menu className="h-6 w-6" />
      </button>
    </>
  );
}

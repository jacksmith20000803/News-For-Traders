"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard,
  TrendingUp,
  Eye,
  Wallet,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Newspaper,
  Users,
  UserRound,
  PlugZap,
  Flame,
  Search,
  Calendar,
  Download,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useConnectionStatus } from "@/components/realtime/sse-provider";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: TrendingUp, label: "Markets", href: "/charts" },
  { icon: Eye, label: "Watchlist", href: "/watchlist" },
  { icon: Newspaper, label: "News", href: "/news" },
  { icon: Users, label: "Community", href: "/community" },
  { icon: Flame, label: "Heatmap", href: "/heatmap" },
  { icon: Search, label: "Research", href: "/research" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: Download, label: "Download", href: "/dashboard/download" },
  { icon: Wallet, label: "Portfolio Data", href: "/dashboard/portfolio" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const settingsNavItems = [
  { icon: UserRound, label: "Account & Profile", href: "/dashboard/settings?section=profile", section: "profile" },
  { icon: Bell, label: "Notifications", href: "/dashboard/settings?section=notifications", section: "notifications" },
  { icon: PlugZap, label: "Connections", href: "/dashboard/settings?section=connections", section: "connections" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { status } = useConnectionStatus();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const displayName = user?.name?.trim() || "Trader";
  const displayMeta = user?.username ? `@${user.username}` : "Workspace";
  const displayInitial = displayName.charAt(0).toUpperCase() || "U";
  const liveStatus =
    status === "connected"
      ? {
        label: "Live Markets Connected",
        compactLabel: "Connected",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        dotClassName: "bg-emerald-500",
        icon: Wifi,
      }
      : status === "disconnected"
        ? {
          label: "Live Markets Not Connected",
          compactLabel: "Offline",
          className: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
          dotClassName: "bg-red-500",
          icon: WifiOff,
        }
        : {
          label: "Live Markets Connecting",
          compactLabel: "Connecting",
          className: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
          dotClassName: "bg-blue-500",
          icon: Loader2,
        };
  const LiveIcon = liveStatus.icon;
  const isSettingsRoute = pathname.startsWith("/dashboard/settings");
  const activeSettingsSection = searchParams.get("section") || "profile";
  const showSettingsChildren = !isCollapsed && (settingsExpanded || isSettingsRoute);
  const isRouteActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
          style={{position: "absolute", background: "none"}}
          className="absolute -right-3 top-4 z-30 hidden h-7 w-7 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:bg-emerald-400 lg:flex"
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
          {isCollapsed ? (
            <div className="flex items-center gap-3 justify-center">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground"
                style={
                  user?.avatar
                    ? {
                      backgroundImage: `url(${user.avatar})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }
                    : undefined
                }
              >
                {!user?.avatar && displayInitial}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayMeta}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground"
                style={
                  user?.avatar
                    ? {
                      backgroundImage: `url(${user.avatar})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }
                    : undefined
                }
              >
                {!user?.avatar && displayInitial}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayMeta}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-3 pb-24">
          {navItems.map((item) => {
            const isSettingsItem = item.href === "/dashboard/settings";
            const isActive = isSettingsItem ? isSettingsRoute : isRouteActive(item.href);
            const Icon = item.icon;

            if (isSettingsItem) {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => setSettingsExpanded((expanded) => !expanded)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-transparent transition-all duration-200",
                      "hover:bg-gray-100 hover:ring-blue-400/45 active:scale-[0.98] dark:hover:bg-white/5 dark:hover:ring-blue-300/35",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-blue-400/70"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isCollapsed ? item.label : undefined}
                    aria-expanded={showSettingsChildren}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-foreground")} />
                    {!isCollapsed && (
                      <>
                        <span className="min-w-0 flex-1 text-left text-sm font-medium">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            showSettingsChildren && "rotate-180"
                          )}
                        />
                      </>
                    )}
                  </button>

                  {showSettingsChildren && (
                    <div className="mt-1 space-y-1 pl-4">
                      {settingsNavItems.map((child) => {
                        const ChildIcon = child.icon;
                        const childIsActive = activeSettingsSection === child.section;

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition-all duration-200",
                              "hover:bg-blue-500/10 hover:text-foreground active:scale-[0.98] dark:hover:bg-blue-400/10",
                              childIsActive
                                ? "border border-blue-400/70 bg-blue-500/10 text-blue-600 dark:text-blue-200"
                                : "text-muted-foreground"
                            )}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg ring-1 ring-transparent transition-all duration-200",
                  "hover:bg-gray-100 hover:ring-blue-400/45 dark:hover:bg-white/5 dark:hover:ring-blue-300/35",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-blue-400/70"
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
          <div className={cn("rounded-2xl border p-3 shadow-sm transition-colors", liveStatus.className)}>
            <div className="flex items-center gap-2">
              <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background/70")}>
                <span className={cn("absolute right-1 top-1 h-2 w-2 rounded-full", liveStatus.dotClassName, status !== "disconnected" && "animate-pulse")} />
                <LiveIcon className={cn("h-4 w-4", status !== "connected" && status !== "disconnected" && "animate-spin")} />
              </span>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold">{liveStatus.label}</p>
                  <p className="truncate text-[10px] opacity-75">{liveStatus.compactLabel}</p>
                </div>
              )}
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

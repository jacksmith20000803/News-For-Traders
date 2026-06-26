"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function getRouteBackground(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "route-dashboard-bg";
  if (pathname.startsWith("/charts") || pathname.startsWith("/assets") || pathname.startsWith("/heatmap")) return "route-markets-bg";
  if (pathname.startsWith("/news") || pathname.startsWith("/research") || pathname.startsWith("/knowledge")) return "route-news-bg";
  if (pathname.startsWith("/community")) return "route-community-bg";
  if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) return "route-auth-bg";
  if (pathname.startsWith("/support") || pathname.startsWith("/profile") || pathname.startsWith("/admin")) return "route-support-bg";
  return "route-home-bg";
}

export function RouteMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className={cn("app-main flex-1 overflow-auto", getRouteBackground(pathname))} suppressHydrationWarning>
      {children}
    </main>
  );
}

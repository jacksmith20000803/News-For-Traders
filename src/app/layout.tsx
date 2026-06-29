import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SSEProvider } from "@/components/realtime/sse-provider";
import { RealtimeSyncProvider } from "@/components/realtime/realtime-sync";
import { ActivityTracker } from "@/components/analytics/activity-tracker";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RouteMain } from "@/components/layout/route-main";
import { SidebarGate } from "@/components/layout/sidebar-gate";
import { PriceTicker } from "@/components/layout/price-ticker";
import { PageLoader } from "@/components/loading/page-loader";
import { AIChatEntry } from "@/components/layout/ai-chat-entry";
import { HydrationCleanup } from "@/components/layout/hydration-cleanup";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TRADX - Trade. Invest. Grow.",
    template: "%s | TRADX",
  },
  description:
    "Premium real-time trading platform. Live markets, advanced charts, portfolio tracking, and AI research.",
  icons: { icon: "/tradx-logo.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <HydrationCleanup />
        <ThemeProvider>
          <AuthProvider initialUser={null}>
            <SSEProvider>
              <RealtimeSyncProvider>
                <PageLoader />
                <div className="flex flex-col min-h-full" suppressHydrationWarning>
                  <Header />
                  <PriceTicker />
                  <div className="flex flex-1" suppressHydrationWarning>
                    <SidebarGate />
                    <RouteMain>
                      {children}
                    </RouteMain>
                  </div>
                  <Footer />
                  <AIChatEntry />
                  <Suspense fallback={null}>
                    <ActivityTracker />
                  </Suspense>
                </div>
              </RealtimeSyncProvider>
            </SSEProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

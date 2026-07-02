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

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradx.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: "TRADX",
  alternates: {
    canonical: "/",
  },
  title: {
    default: "TRADX - Trade. Invest. Grow.",
    template: "%s | TRADX",
  },
  description:
    "Premium real-time trading platform. Live markets, advanced charts, portfolio tracking, and AI research.",
  keywords: [
    "TRADX",
    "trading platform",
    "real-time crypto prices",
    "market news",
    "portfolio analytics",
    "AI trading assistant",
  ],
  creator: "TRADX",
  publisher: "TRADX",
  category: "finance",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/tradx-logo.webp", type: "image/webp", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/tradx-logo.webp", type: "image/webp", sizes: "512x512" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TRADX",
    title: "TRADX - Trade. Invest. Grow.",
    description:
      "Real-time market prices, charts, news, portfolio tools, and AI research for active traders.",
    images: [{ url: "/tradx-logo.webp", width: 512, height: 512, alt: "TRADX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TRADX - Trade. Invest. Grow.",
    description:
      "Real-time market prices, charts, news, portfolio tools, and AI research for active traders.",
    images: ["/tradx-logo.webp"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <head>
        <link rel="preconnect" href="https://api.coingecko.com" />
        <link rel="preconnect" href="https://static2.finnhub.io" crossOrigin="" />
        <link rel="preconnect" href="https://images.investinglive.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://puter.com" />
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        <link rel="preload" href="/tradx-logo.webp" as="image" type="image/webp" />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <HydrationCleanup />
        <ThemeProvider>
          <AuthProvider initialUser={null}>
            <SSEProvider>
              <RealtimeSyncProvider>
                <PageLoader />
                <div className="flex min-h-full min-w-0 flex-col" suppressHydrationWarning>
                  <Header />
                  <PriceTicker />
                  <div className="flex min-w-0 flex-1" suppressHydrationWarning>
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

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SSEProvider } from "@/components/realtime/sse-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser, toSafeUser } from "@/lib/auth/session";
import { enforceMaintenanceMode } from "@/lib/maintenance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MarketPulse — Financial Market Intelligence",
    template: "%s | MarketPulse",
  },
  description:
    "Reliable, real-time financial market intelligence for professional traders. Accuracy over quantity.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await enforceMaintenanceMode();

  const user = await getCurrentUser();
  const safeUser = user ? toSafeUser(user) : null;

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider>
          <AuthProvider initialUser={safeUser}>
            <SSEProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </SSEProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

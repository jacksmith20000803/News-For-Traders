"use client";

import { motion } from "framer-motion";
import { ButtonLink } from "@/components/ui/button";
import { TrendingUp, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";

interface MarketPerspective {
  title: string;
  content: string;
  date: string;
  sentiment: "Bullish" | "Neutral" | "Bearish";
  confidence: number;
}

const perspectives: MarketPerspective[] = [
  {
    title: "Market Perspective",
    content: "Volatility creates opportunity. Our approach prioritizes disciplined risk management and long-term conviction over short-term speculation.",
    date: "January 15, 2025",
    sentiment: "Bullish",
    confidence: 78,
  },
  {
    title: "Founder's View",
    content: "The current market cycle presents unique opportunities for systematic investors. We're seeing increased institutional adoption of digital assets.",
    date: "January 15, 2025",
    sentiment: "Bullish",
    confidence: 85,
  },
  {
    title: "Weekly Outlook",
    content: "Macro indicators suggest a potential shift in monetary policy. Position sizing and risk allocation remain critical in this environment.",
    date: "January 15, 2025",
    sentiment: "Neutral",
    confidence: 72,
  },
];

export function ModernHero() {
  const [currentPerspective, setCurrentPerspective] = useState(0);
  const mounted = useMounted();
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? (resolvedTheme ?? "dark") : (theme ?? "dark");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPerspective((prev) => (prev + 1) % perspectives.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const perspective = perspectives[currentPerspective];
  const sentimentColor = {
    Bullish: currentTheme === "dark" ? "text-emerald-400" : "text-emerald-600",
    Neutral: currentTheme === "dark" ? "text-gray-400" : "text-gray-600",
    Bearish: currentTheme === "dark" ? "text-red-400" : "text-red-600",
  }[perspective.sentiment];

  const bgColor = currentTheme === "dark" ? "bg-[#0a0c0c]" : "bg-gray-50";
  const textColor = currentTheme === "dark" ? "text-white" : "text-gray-900";
  const secondaryTextColor = currentTheme === "dark" ? "text-gray-400" : "text-gray-600";
  const gridColor = currentTheme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.05)";
  const glowColor = currentTheme === "dark" ? "rgba(16,185,129,0.04)" : "rgba(16,185,129,0.08)";
  const waveColor = currentTheme === "dark" ? "from-emerald-500/2" : "from-emerald-500/5";
  const bars = Array.from({ length: 20 }, (_, index) => ({
    height: 40 + ((index * 37) % 60),
    duration: 1.5 + ((index * 13) % 10) / 10,
    delay: ((index * 7) % 5) / 10,
  }));

  return (
    <div className={cn("relative min-h-screen overflow-hidden", bgColor)} suppressHydrationWarning>
      {/* Abstract Background */}
      <div className="absolute inset-0" suppressHydrationWarning>
        {/* Grid Pattern */}
        <div
          className="absolute inset-0"
          suppressHydrationWarning
          style={{
            backgroundImage: `
              linear-gradient(${gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial Glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
          suppressHydrationWarning
          style={{
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            animation: "glow-pulse 8s ease-in-out infinite",
          }}
        />
        {/* Subtle Wave Pattern */}
        <div className={cn("absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t", waveColor, "to-transparent")} suppressHydrationWarning />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6 py-20 sm:py-32" suppressHydrationWarning>
        <div className="grid gap-12 lg:grid-cols-2 items-center" suppressHydrationWarning>
          {/* Left Side - Primary Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
            suppressHydrationWarning
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className={cn("text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight", textColor)}
              suppressHydrationWarning
            >
              Trade with clarity.
              <br />
              <span className="text-emerald-400">Invest with conviction.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className={cn("text-lg sm:text-xl max-w-2xl", secondaryTextColor)}
              suppressHydrationWarning
            >
              Institutional-grade trading tools for modern investors. Real-time market data,
              advanced analytics, and expert perspectives in one premium terminal.
            </motion.p>

            {/* Trading-themed animation */}
            {mounted ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="relative h-48 overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/70 shadow-2xl shadow-cyan-950/10 backdrop-blur dark:bg-[#0d1114]/80 dark:shadow-black/30"
                suppressHydrationWarning
              >
                <div
                  className="absolute inset-0 opacity-70"
                  suppressHydrationWarning
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(56,189,248,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.14) 1px, transparent 1px)",
                    backgroundSize: "34px 34px",
                  }}
                />
                <svg className="absolute inset-x-0 top-8 h-28 w-full text-cyan-400" viewBox="0 0 680 160" preserveAspectRatio="none">
                  <motion.path
                    d="M0 116 C72 84 108 130 176 92 S304 52 380 76 S500 120 580 64 S652 42 680 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0.25 }}
                    animate={{ pathLength: [0, 1, 1], opacity: [0.28, 1, 0.48] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.path
                    d="M0 116 C72 84 108 130 176 92 S304 52 380 76 S500 120 580 64 S652 42 680 32 L680 160 L0 160 Z"
                    fill="url(#heroSignalFill)"
                    initial={{ opacity: 0.08 }}
                    animate={{ opacity: [0.08, 0.2, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <defs>
                    <linearGradient id="heroSignalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-3" suppressHydrationWarning>
                  <div className="flex h-24 items-end gap-2" suppressHydrationWarning>
                    {bars.map((bar, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 rounded-full bg-gradient-to-t from-cyan-500/10 via-cyan-300/80 to-white/60 shadow-[0_0_18px_rgba(56,189,248,0.45)]"
                        initial={{ height: 10 }}
                        animate={{
                          height: [10, bar.height, 10],
                        }}
                        transition={{
                          duration: bar.duration,
                          repeat: Infinity,
                          delay: bar.delay,
                        }}
                        style={{ width: "4px" }}
                      />
                    ))}
                  </div>
                  <div className="grid min-w-28 gap-2 text-right" suppressHydrationWarning>
                    {[
                      ["BTC", "+2.14%"],
                      ["ETH", "+0.86%"],
                      ["SOL", "+4.31%"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-cyan-300/20 bg-black/35 px-3 py-1.5 text-xs text-cyan-50 shadow-lg backdrop-blur" suppressHydrationWarning>
                        <span className="mr-2 font-mono text-cyan-200">{label}</span>
                        <span className="font-bold text-emerald-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent animate-shimmer" suppressHydrationWarning />
                <style jsx>{`
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  .animate-shimmer {
                    animation: shimmer 3s ease-in-out infinite;
                  }
                `}</style>
              </motion.div>
            ) : (
              <div
                className="relative h-48 overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/70 shadow-2xl shadow-cyan-950/10 backdrop-blur dark:bg-[#0d1114]/80 dark:shadow-black/30"
                suppressHydrationWarning
                aria-hidden="true"
              />
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="flex flex-wrap gap-4"
              suppressHydrationWarning
            >
              <div suppressHydrationWarning>
                <ButtonLink
                  href="/register"
                  size="lg"
                  className="btn-3d px-8 py-4 text-base font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white dark:text-gray-900"
                >
                  Start Trading
                </ButtonLink>
              </div>
              <div suppressHydrationWarning>
                <ButtonLink
                  href="/charts"
                  size="lg"
                  variant="outline"
                  className="btn-3d px-8 py-4 text-base font-medium text-foreground border-border"
                >
                  Explore Markets
                </ButtonLink>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Market Perspective Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="hidden lg:block"
            suppressHydrationWarning
          >
            <div className="card-3d-enhanced rounded-2xl p-6 sm:p-8 bg-white dark:bg-[#111114] border border-gray-200 dark:border-white/6" suppressHydrationWarning>
              {/* Card Header */}
              <div className="flex items-start justify-between mb-6" suppressHydrationWarning>
                <div className="flex items-center gap-3" suppressHydrationWarning>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/10" suppressHydrationWarning>
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div suppressHydrationWarning>
                    <h3 className={cn("text-lg font-semibold", textColor)}>
                      {perspective.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1" suppressHydrationWarning>
                      <Calendar className={cn("w-3 h-3", secondaryTextColor)} />
                      <span className={cn("text-xs", secondaryTextColor)}>
                        {perspective.date}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <motion.div
                key={currentPerspective}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
                suppressHydrationWarning
              >
                <p className={cn("text-base leading-relaxed", secondaryTextColor)}>
                  {perspective.content}
                </p>
              </motion.div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/6" suppressHydrationWarning>
                <div className="flex items-center gap-2" suppressHydrationWarning>
                  <span className={`text-sm font-medium ${sentimentColor}`}>
                    {perspective.sentiment}
                  </span>
                  <span className="text-gray-500">-</span>
                  <span className="text-sm text-gray-400">
                    Confidence: {perspective.confidence}%
                  </span>
                </div>
                <div className="flex gap-1" suppressHydrationWarning>
                  {perspectives.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPerspective(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentPerspective ? "w-2 bg-emerald-400" : "w-1.5 bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

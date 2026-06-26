"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import { FeedbackForm } from "@/components/feedback/feedback-form";

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Charts",
    desc: "TradingView-grade candlesticks with SMA, EMA, RSI, and MACD.",
  },
  {
    icon: Zap,
    title: "Live Market Data",
    desc: "Streaming prices across crypto, forex, stocks, and indices.",
  },
  {
    icon: Shield,
    title: "Institutional Security",
    desc: "CSRF protection, RBAC, audit logs, and rate limiting.",
  },
];

export function LandingHero() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),transparent)]" />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mb-8 flex justify-center">
            <Logo variant="hero" showTagline />
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            The professional trading platform{" "}
            <span className="gradient-text">built for precision</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Real-time markets, advanced charts, portfolio tracking, and AI-powered research —
            all in one premium terminal.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink
              href="/register"
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
            >
              Start Trading
              <ArrowRight className="ml-2 h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/charts" size="lg" variant="outline">
              View Charts
            </ButtonLink>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-20 grid gap-6 sm:grid-cols-3"
        >
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="hero-card group"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-transform group-hover:scale-110">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section id="contact" className="border-t border-white/5 bg-black/20 py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="mb-2 text-center text-2xl font-bold">Get in Touch</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Contact us, report bugs, or share suggestions
          </p>
          <FeedbackForm />
        </div>
      </section>
    </div>
  );
}

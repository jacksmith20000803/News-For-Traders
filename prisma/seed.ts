import { config } from "dotenv";
config({ path: ".env" });

import { db as prisma } from "../src/lib/db";
import * as argon2 from "argon2";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    console.error("Refusing to seed production database. Set ALLOW_SEED=true to override.");
    process.exit(1);
  }

  console.log("Seeding system data (no fake news content)...");

  const passwordHash = await argon2.hash("Admin123!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const userPasswordHash = await argon2.hash("User1234!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.user.upsert({
    where: { email: "admin@marketpulse.com" },
    update: {},
    create: {
      email: "admin@marketpulse.com",
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
      emailVerified: new Date(),
      reputation: 1000,
      contributionCount: 0,
    },
  });

  // Delete all non-admin users
  await prisma.user.deleteMany({
    where: {
      role: { not: "ADMIN" },
    },
  });

  await prisma.badge.upsert({
    where: { name: "Early Adopter" },
    update: {},
    create: {
      name: "Early Adopter",
      description: "Joined during platform launch",
      icon: "star",
    },
  });

  await prisma.siteSetting.upsert({
    where: { key: "maintenance_mode" },
    update: {},
    create: { key: "maintenance_mode", value: "false" },
  });

  await prisma.siteSetting.upsert({
    where: { key: "platform_version" },
    update: { value: "2.1.0" },
    create: { key: "platform_version", value: "2.1.0" },
  });

  await prisma.siteSetting.upsert({
    where: { key: "platform_background_image" },
    update: {},
    create: { key: "platform_background_image", value: "" },
  });

  // Asset profiles for detail pages
  const assets = [
    { slug: "BTC", symbol: "BTC/USD", assetType: "crypto", category: "CRYPTO" as const, name: "Bitcoin", description: "Leading cryptocurrency by market cap" },
    { slug: "EURUSD", symbol: "EUR/USD", assetType: "forex", category: "FOREX" as const, name: "Euro / US Dollar", description: "Most traded currency pair globally" },
    { slug: "XAUUSD", symbol: "XAU/USD", assetType: "commodity", category: "COMMODITIES" as const, name: "Gold", description: "Safe-haven precious metal benchmark" },
    { slug: "AAPL", symbol: "AAPL", assetType: "stock", category: "STOCKS" as const, name: "Apple Inc.", description: "Technology giant and S&P 500 component" },
    { slug: "NVDA", symbol: "NVDA", assetType: "stock", category: "STOCKS" as const, name: "NVIDIA Corp.", description: "AI and GPU semiconductor leader" },
    { slug: "ETH", symbol: "ETH/USD", assetType: "crypto", category: "CRYPTO" as const, name: "Ethereum", description: "Smart contract platform" },
  ];

  for (const a of assets) {
    await prisma.assetProfile.upsert({
      where: { slug: a.slug },
      update: { name: a.name, description: a.description },
      create: a,
    });
  }

  // Economic calendar events (next 90 days)
  const now = new Date();
  const events = [
    { type: "CPI" as const, title: "US Consumer Price Index (MoM)", impact: "HIGH" as const, dayOffset: 7, hour: 8, minute: 30 },
    { type: "NFP" as const, title: "US Non-Farm Payrolls", impact: "HIGH" as const, dayOffset: 14, hour: 8, minute: 30 },
    { type: "FOMC" as const, title: "FOMC Interest Rate Decision", impact: "HIGH" as const, dayOffset: 21, hour: 14, minute: 0 },
    { type: "GDP" as const, title: "US GDP (QoQ Advance)", impact: "HIGH" as const, dayOffset: 28, hour: 8, minute: 30 },
    { type: "UNEMPLOYMENT" as const, title: "US Unemployment Rate", impact: "MEDIUM" as const, dayOffset: 14, hour: 8, minute: 30 },
    { type: "CPI" as const, title: "US Core CPI (YoY)", impact: "HIGH" as const, dayOffset: 37, hour: 8, minute: 30 },
    { type: "FOMC" as const, title: "FOMC Meeting Minutes", impact: "MEDIUM" as const, dayOffset: 35, hour: 14, minute: 0 },
    { type: "GDP" as const, title: "US GDP (QoQ Final)", impact: "MEDIUM" as const, dayOffset: 56, hour: 8, minute: 30 },
    { type: "UNEMPLOYMENT" as const, title: "US Initial Jobless Claims", impact: "LOW" as const, dayOffset: 3, hour: 8, minute: 30 },
    { type: "NFP" as const, title: "US Average Hourly Earnings", impact: "MEDIUM" as const, dayOffset: 14, hour: 8, minute: 30 },
  ];

  await prisma.economicEvent.deleteMany({});
  for (const e of events) {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + e.dayOffset);
    scheduledAt.setHours(e.hour, e.minute, 0, 0);
    await prisma.economicEvent.create({
      data: {
        type: e.type,
        title: e.title,
        country: "US",
        scheduledAt,
        impact: e.impact,
        previous: "—",
        forecast: "—",
        timezone: "America/New_York",
      },
    });
  }

  // Sample price history for charting (30 days synthetic)
  const priceSeeds = [
    { symbol: "BTC/USD", assetType: "crypto", base: 95000 },
    { symbol: "EUR/USD", assetType: "forex", base: 1.08 },
    { symbol: "XAU/USD", assetType: "commodity", base: 2650 },
    { symbol: "AAPL", assetType: "stock", base: 220 },
    { symbol: "NVDA", assetType: "stock", base: 130 },
  ];

  await prisma.priceHistory.deleteMany({});
  for (const ps of priceSeeds) {
    for (let d = 30; d >= 0; d--) {
      const ts = new Date(now);
      ts.setDate(ts.getDate() - d);
      const drift = (Math.random() - 0.48) * ps.base * 0.02;
      const price = ps.base + drift * (30 - d) / 30;
      await prisma.priceHistory.create({
        data: { symbol: ps.symbol, assetType: ps.assetType, price, timestamp: ts },
      });
    }
  }

  // Create market quotes for real-time data
  await prisma.marketQuote.deleteMany({});
  for (const ps of priceSeeds) {
    const currentPrice = ps.base + (Math.random() - 0.5) * ps.base * 0.01;
    await prisma.marketQuote.create({
      data: {
        symbol: ps.symbol,
        assetType: ps.assetType,
        price: currentPrice,
        change: (Math.random() - 0.5) * ps.base * 0.02,
        changePercent: (Math.random() - 0.5) * 2,
        providerName: "seed",
      },
    });
  }

  // Demo trader watchlist + portfolio
  const trader = await prisma.user.findUnique({ where: { email: "trader@marketpulse.com" } });
  if (trader) {
    const wl = await prisma.watchlist.upsert({
      where: { id: "seed-trader-wl" },
      update: {},
      create: {
        id: "seed-trader-wl",
        userId: trader.id,
        name: "Macro Watch",
        category: "FOREX",
        sortOrder: 0,
      },
    });

    const items = [
      { symbol: "EUR/USD", assetType: "forex", category: "FOREX" as const, sortOrder: 0 },
      { symbol: "XAU/USD", assetType: "commodity", category: "COMMODITIES" as const, sortOrder: 1 },
      { symbol: "BTC/USD", assetType: "crypto", category: "CRYPTO" as const, sortOrder: 2 },
      { symbol: "AAPL", assetType: "stock", category: "STOCKS" as const, sortOrder: 3 },
    ];

    for (const item of items) {
      await prisma.watchlistItem.upsert({
        where: { watchlistId_symbol_assetType: { watchlistId: wl.id, symbol: item.symbol, assetType: item.assetType } },
        update: { sortOrder: item.sortOrder },
        create: { watchlistId: wl.id, ...item },
      });
    }

    const portfolio = await prisma.portfolio.upsert({
      where: { userId_name: { userId: trader.id, name: "Main Portfolio" } },
      update: {},
      create: { userId: trader.id, name: "Main Portfolio" },
    });

    await prisma.portfolioPosition.deleteMany({ where: { portfolioId: portfolio.id } });
    await prisma.portfolioPosition.createMany({
      data: [
        { portfolioId: portfolio.id, symbol: "AAPL", assetType: "stock", category: "STOCKS", quantity: 50, entryPrice: 195 },
        { portfolioId: portfolio.id, symbol: "NVDA", assetType: "stock", category: "STOCKS", quantity: 20, entryPrice: 110 },
        { portfolioId: portfolio.id, symbol: "BTC/USD", assetType: "crypto", category: "CRYPTO", quantity: 0.5, entryPrice: 88000 },
      ],
    });
  }

  await prisma.user.updateMany({
    where: { email: { in: ["admin@marketpulse.com", "trader@marketpulse.com", "mod@marketpulse.com"] } },
    data: { onboardingCompleted: true },
  });

  await prisma.chatSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      welcomeMessage: "Welcome to TRADX support! How can we help you today?",
      offlineMessage: "Our team is currently offline. Leave a message and we'll respond soon.",
    },
  });

  console.log("Seed complete.");
  console.log("Admin account:");
  console.log("  admin@marketpulse.com / Admin123!");
  console.log("");
  console.log("Configure FINNHUB_API_KEY, ALPHAVANTAGE_API_KEY, etc. then run: npm run ingest:news");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

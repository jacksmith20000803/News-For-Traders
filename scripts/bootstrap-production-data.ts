#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env" });

import * as argon2 from "argon2";
import { db } from "../src/lib/db";
import {
  DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY,
  FALLBACK_DOWNLOAD_REPORT_TIMEZONE,
} from "../src/lib/download/report-timezone";
import {
  DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD,
  DEFAULT_TRADING_BOT_DOWNLOAD_MODE,
  TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY,
  TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY,
  TRADING_BOT_DOWNLOAD_URL_SETTING_KEY,
} from "../src/lib/download/trading-bot-links";
import { ingestMarketQuotes, ingestNewsFromProviders } from "../src/lib/providers/news/ingest";
import { updateMarketQuotes } from "../src/lib/market/realtime-fetcher";

type BootstrapAsset = {
  slug: string;
  symbol: string;
  assetType: string;
  category: "CRYPTO" | "FOREX" | "COMMODITIES" | "STOCKS";
  name: string;
  description: string;
  coinGeckoId?: string;
  basePrice: number;
};

const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@maketpulse.com";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const HISTORY_DAYS = normalizePositiveInt(process.env.BOOTSTRAP_HISTORY_DAYS, 183);
const PROVIDER_NAME = "bootstrap-history";

const ASSETS: BootstrapAsset[] = [
  { slug: "BTC", symbol: "BTC/USD", assetType: "crypto", category: "CRYPTO", name: "Bitcoin", description: "Leading cryptocurrency by market cap", coinGeckoId: "bitcoin", basePrice: 108000 },
  { slug: "ETH", symbol: "ETH/USD", assetType: "crypto", category: "CRYPTO", name: "Ethereum", description: "Smart contract platform", coinGeckoId: "ethereum", basePrice: 3600 },
  { slug: "SOL", symbol: "SOL/USD", assetType: "crypto", category: "CRYPTO", name: "Solana", description: "High-performance smart contract network", coinGeckoId: "solana", basePrice: 160 },
  { slug: "XRP", symbol: "XRP/USD", assetType: "crypto", category: "CRYPTO", name: "XRP", description: "Payments-focused digital asset", coinGeckoId: "ripple", basePrice: 0.58 },
  { slug: "ADA", symbol: "ADA/USD", assetType: "crypto", category: "CRYPTO", name: "Cardano", description: "Research-driven proof-of-stake blockchain", coinGeckoId: "cardano", basePrice: 0.48 },
  { slug: "DOGE", symbol: "DOGE/USD", assetType: "crypto", category: "CRYPTO", name: "Dogecoin", description: "Community-driven digital currency", coinGeckoId: "dogecoin", basePrice: 0.14 },
  { slug: "DOT", symbol: "DOT/USD", assetType: "crypto", category: "CRYPTO", name: "Polkadot", description: "Interoperable multi-chain network", coinGeckoId: "polkadot", basePrice: 6.5 },
  { slug: "BNB", symbol: "BNB/USD", assetType: "crypto", category: "CRYPTO", name: "BNB", description: "Exchange and smart-chain utility asset", coinGeckoId: "binancecoin", basePrice: 690 },
  { slug: "AVAX", symbol: "AVAX/USD", assetType: "crypto", category: "CRYPTO", name: "Avalanche", description: "High-throughput smart contract platform", coinGeckoId: "avalanche-2", basePrice: 36 },
  { slug: "LINK", symbol: "LINK/USD", assetType: "crypto", category: "CRYPTO", name: "Chainlink", description: "Decentralized oracle network", coinGeckoId: "chainlink", basePrice: 15 },
  { slug: "UNI", symbol: "UNI/USD", assetType: "crypto", category: "CRYPTO", name: "Uniswap", description: "Decentralized exchange governance token", coinGeckoId: "uniswap", basePrice: 9 },
  { slug: "ATOM", symbol: "ATOM/USD", assetType: "crypto", category: "CRYPTO", name: "Cosmos", description: "Interoperable blockchain ecosystem", coinGeckoId: "cosmos", basePrice: 7 },
  { slug: "LTC", symbol: "LTC/USD", assetType: "crypto", category: "CRYPTO", name: "Litecoin", description: "Peer-to-peer digital currency", coinGeckoId: "litecoin", basePrice: 85 },
  { slug: "ETC", symbol: "ETC/USD", assetType: "crypto", category: "CRYPTO", name: "Ethereum Classic", description: "Original Ethereum proof-of-work chain", coinGeckoId: "ethereum-classic", basePrice: 24 },
  { slug: "EURUSD", symbol: "EUR/USD", assetType: "forex", category: "FOREX", name: "Euro / US Dollar", description: "Most traded currency pair globally", basePrice: 1.08 },
  { slug: "XAUUSD", symbol: "XAU/USD", assetType: "commodity", category: "COMMODITIES", name: "Gold", description: "Safe-haven precious metal benchmark", basePrice: 2650 },
  { slug: "AAPL", symbol: "AAPL", assetType: "stock", category: "STOCKS", name: "Apple Inc.", description: "Technology giant and S&P 500 component", basePrice: 220 },
  { slug: "NVDA", symbol: "NVDA", assetType: "stock", category: "STOCKS", name: "NVIDIA Corp.", description: "AI and GPU semiconductor leader", basePrice: 130 },
  { slug: "SPY", symbol: "SPY", assetType: "stock", category: "STOCKS", name: "SPDR S&P 500 ETF", description: "Broad S&P 500 market proxy", basePrice: 580 },
  { slug: "QQQ", symbol: "QQQ", assetType: "stock", category: "STOCKS", name: "Invesco QQQ Trust", description: "Nasdaq-100 market proxy", basePrice: 500 },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  console.log("Bootstrapping production database...");
  await ensureSystemSettings();
  await ensureAdminAccount();
  await ensureAssetProfiles();
  await ensureHistoricalPrices();
  await refreshCurrentMarketData();
  await ingestLiveNews();
  await ensureHistoricalNewsTimeline();

  console.log("Bootstrap complete.");
}

async function ensureAdminAccount() {
  if (!ADMIN_PASSWORD) {
    console.log("BOOTSTRAP_ADMIN_PASSWORD is not set; skipping admin account bootstrap.");
    return;
  }

  const passwordHash = await argon2.hash(ADMIN_PASSWORD!, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
      emailVerified: new Date(),
      onboardingCompleted: true,
      isSuspended: false,
      isBanned: false,
      deletedAt: null,
    },
    create: {
      email: ADMIN_EMAIL,
      username: "weasel_admin",
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
      emailVerified: new Date(),
      onboardingCompleted: true,
      reputation: 1000,
      contributionCount: 0,
    },
  });

  console.log(`Admin ensured: ${ADMIN_EMAIL}`);
}

async function ensureSystemSettings() {
  const settings = [
    ["maintenance_mode", "false"],
    ["platform_version", "3.0.0"],
    ["platform_background_image", ""],
    [TRADING_BOT_DOWNLOAD_URL_SETTING_KEY, ""],
    [TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY, DEFAULT_TRADING_BOT_DOWNLOAD_MODE],
    [TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY, DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD],
    [DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY, FALLBACK_DOWNLOAD_REPORT_TIMEZONE],
  ] as const;

  for (const [key, value] of settings) {
    await db.siteSetting.upsert({
      where: { key },
      update: key === "platform_version" ? { value } : {},
      create: { key, value },
    });
  }

  await db.chatSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      welcomeMessage: "Welcome to TRADX support! How can we help you today?",
      offlineMessage: "Our team is currently offline. Leave a message and we'll respond soon.",
    },
  });
}

async function ensureAssetProfiles() {
  for (const asset of ASSETS) {
    await db.assetProfile.upsert({
      where: { slug: asset.slug },
      update: {
        symbol: asset.symbol,
        assetType: asset.assetType,
        category: asset.category,
        name: asset.name,
        description: asset.description,
      },
      create: {
        slug: asset.slug,
        symbol: asset.symbol,
        assetType: asset.assetType,
        category: asset.category,
        name: asset.name,
        description: asset.description,
      },
    });
  }
}

async function ensureHistoricalPrices() {
  const start = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  for (const asset of ASSETS) {
    console.log(`Preparing ${HISTORY_DAYS} days of history for ${asset.symbol}...`);
    const rows = asset.coinGeckoId
      ? await fetchCoinGeckoHistory(asset, HISTORY_DAYS).catch((error) => {
          console.warn(`CoinGecko history failed for ${asset.symbol}; using fallback.`, compactError(error));
          return generateFallbackHistory(asset, HISTORY_DAYS);
        })
      : generateFallbackHistory(asset, HISTORY_DAYS);

    if (rows.length === 0) continue;

    await db.priceHistory.deleteMany({
      where: {
        symbol: asset.symbol,
        assetType: asset.assetType,
        timestamp: { gte: start },
      },
    });

    for (const batch of chunk(rows, 500)) {
      await db.priceHistory.createMany({ data: batch });
    }

    const latest = rows[rows.length - 1];
    const previous = rows[Math.max(0, rows.length - 2)];
    const change = latest.price - previous.price;
    const changePercent = previous.price > 0 ? (change / previous.price) * 100 : 0;

    await db.marketQuote.upsert({
      where: { symbol_assetType: { symbol: asset.symbol, assetType: asset.assetType } },
      create: {
        symbol: asset.symbol,
        assetType: asset.assetType,
        name: asset.name,
        price: latest.price,
        change,
        changePercent,
        providerName: asset.coinGeckoId ? "coingecko" : "bootstrap-fallback",
      },
      update: {
        name: asset.name,
        price: latest.price,
        change,
        changePercent,
        providerName: asset.coinGeckoId ? "coingecko" : "bootstrap-fallback",
      },
    });
  }
}

async function fetchCoinGeckoHistory(asset: BootstrapAsset, days: number) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${asset.coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    {
      headers: { "User-Agent": "TRADX/1.0" },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
  const payload = (await response.json()) as { prices?: [number, number][]; total_volumes?: [number, number][] };
  const prices = payload.prices ?? [];
  if (prices.length === 0) throw new Error("CoinGecko returned no prices");

  return prices.map(([timestamp, price], index) => {
    const previous = index > 0 ? prices[index - 1][1] : price;
    const open = previous;
    const close = price;
    return {
      symbol: asset.symbol,
      assetType: asset.assetType,
      price,
      timestamp: new Date(timestamp),
      volume: payload.total_volumes?.[index]?.[1] ?? null,
      open,
      close,
      high: Math.max(open, close) * 1.01,
      low: Math.min(open, close) * 0.99,
    };
  });
}

function generateFallbackHistory(asset: BootstrapAsset, days: number) {
  const rows = [];
  let previous = asset.basePrice;
  const start = Date.now() - (days - 1) * 24 * 60 * 60 * 1000;
  const seed = asset.symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

  for (let index = 0; index < days; index++) {
    const drift = (Math.sin((index + seed) / 17) + Math.cos((index + seed) / 29)) * asset.basePrice * 0.004;
    const open = previous;
    const close = Math.max(asset.basePrice * 0.05, open + drift);
    const high = Math.max(open, close) * 1.012;
    const low = Math.min(open, close) * 0.988;
    previous = close;
    rows.push({
      symbol: asset.symbol,
      assetType: asset.assetType,
      price: close,
      timestamp: new Date(start + index * 24 * 60 * 60 * 1000),
      volume: null,
      open,
      close,
      high,
      low,
    });
  }

  return rows;
}

async function refreshCurrentMarketData() {
  try {
    const liveResult = await updateMarketQuotes();
    console.log("Live quote refresh:", liveResult);
  } catch (error) {
    console.warn("Live quote refresh failed:", compactError(error));
  }

  try {
    const updated = await ingestMarketQuotes();
    console.log(`Provider quote ingestion updated ${updated} quotes.`);
  } catch (error) {
    console.warn("Provider quote ingestion failed:", compactError(error));
  }
}

async function ingestLiveNews() {
  try {
    const result = await ingestNewsFromProviders();
    console.log("News provider ingestion:", result);
  } catch (error) {
    console.warn("News provider ingestion failed:", compactError(error));
  }
}

async function ensureHistoricalNewsTimeline() {
  const source = await db.newsSource.upsert({
    where: { name: "TRADX Market Bootstrap" },
    update: { reliabilityScore: 0.7, isActive: true },
    create: {
      name: "TRADX Market Bootstrap",
      url: "https://tradx-pulse.local/bootstrap",
      reliabilityScore: 0.7,
    },
  });

  const category = await db.newsCategory.upsert({
    where: { slug: "market-briefs" },
    update: {},
    create: { name: "Market Briefs", slug: "market-briefs" },
  });

  const templates = [
    { symbol: "BTC/USD", assetType: "crypto", headline: "Bitcoin liquidity conditions remain in focus", summary: "Crypto traders track ETF flows, funding rates, and macro risk appetite." },
    { symbol: "ETH/USD", assetType: "crypto", headline: "Ethereum network activity steadies as traders watch risk assets", summary: "Market participants compare on-chain activity with broader technology-sector sentiment." },
    { symbol: "SOL/USD", assetType: "crypto", headline: "Solana ecosystem momentum keeps active traders engaged", summary: "Liquidity, token launches, and network throughput remain major themes." },
    { symbol: "XAU/USD", assetType: "commodity", headline: "Gold traders weigh inflation data and real-rate expectations", summary: "Precious metals remain sensitive to central-bank policy and dollar direction." },
    { symbol: "SPY", assetType: "stock", headline: "US equity risk appetite sets tone for cross-asset markets", summary: "Index traders monitor earnings breadth, volatility, and policy expectations." },
  ];

  const intervalDays = Math.max(1, Math.floor(HISTORY_DAYS / 140));
  let created = 0;

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= intervalDays) {
    const template = templates[dayOffset % templates.length];
    const publishedAt = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
    publishedAt.setUTCHours(13, 30, 0, 0);
    const dateKey = publishedAt.toISOString().slice(0, 10);
    const externalId = `${dateKey}-${template.symbol.replace(/[^A-Z0-9]/gi, "")}`;

    const existing = await db.news.findFirst({ where: { providerName: PROVIDER_NAME, externalId } });
    if (existing) continue;

    await db.news.create({
      data: {
        headline: `${template.headline} (${dateKey})`,
        summary: template.summary,
        content: `${template.summary} This bootstrap item preserves a one-year news timeline for fresh deployments until live provider history accumulates.`,
        sourceId: source.id,
        categoryId: category.id,
        providerName: PROVIDER_NAME,
        externalId,
        sourceUrl: "https://tradx-pulse.local/bootstrap/news",
        publishedAt,
        reliabilityStatus: "UNVERIFIED",
        assets: { create: [{ symbol: template.symbol, assetType: template.assetType }] },
      },
    });
    created++;
  }

  console.log(`Historical news timeline ensured (${created} created).`);
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function compactError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

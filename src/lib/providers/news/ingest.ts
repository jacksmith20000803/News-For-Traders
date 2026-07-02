import { db } from "@/lib/db";
import { getConfiguredProviders, type NewsItem } from "@/lib/providers/news";
import { eventBus } from "@/lib/events/broadcaster";
import { notifyBreakingNews } from "@/lib/notifications";

async function ensureSource(name: string, url?: string) {
  return db.newsSource.upsert({
    where: { name },
    create: { name, url, reliabilityScore: 0.7 },
    update: {},
  });
}

async function upsertNewsItem(item: NewsItem, providerName: string, sourceId: string) {
  const existing = await db.news.findFirst({
    where: { providerName, externalId: item.externalId },
  });
  if (existing) {
    const news = await db.news.update({
      where: { id: existing.id },
      data: {
        headline: item.headline,
        summary: item.summary,
        content: item.content,
        sourceId,
        sourceUrl: item.sourceUrl,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt,
      },
    });
    return { created: false, id: news.id };
  }

  const news = await db.news.create({
    data: {
      headline: item.headline,
      summary: item.summary,
      content: item.content,
      sourceId,
      providerName,
      externalId: item.externalId,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      reliabilityStatus: "UNVERIFIED",
      assets: item.symbols?.length
        ? { create: item.symbols.map((s) => ({ symbol: s.symbol, assetType: s.assetType })) }
        : undefined,
    },
  });

  eventBus.publish("news", { type: "news.created", id: news.id, headline: news.headline });
  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
    take: 500,
  });
  await notifyBreakingNews({
    userIds: users.map((user) => user.id),
    headline: news.headline,
    newsId: news.id,
  });
  return { created: true, id: news.id };
}

export async function ingestNewsFromProviders(): Promise<{
  processed: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    return { processed: 0, created: 0, skipped: 0, errors: ["No live data provider configured."] };
  }

  let processed = 0;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const provider of configured) {
    const log = await db.ingestionLog.create({
      data: { provider: provider.name, status: "running" },
    });

    try {
      const items = await provider.fetchNews();
      const source = await ensureSource(provider.name);

      for (const item of items) {
        processed++;
        const result = await upsertNewsItem(item, provider.name, source.id);
        if (result.created) created++;
        else skipped++;
      }

      await db.ingestionLog.update({
        where: { id: log.id },
        data: {
          status: "completed",
          itemsProcessed: items.length,
          itemsSkipped: skipped,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${provider.name}: ${msg}`);
      await db.ingestionLog.update({
        where: { id: log.id },
        data: { status: "failed", errorMessage: msg, completedAt: new Date() },
      });
    }
  }

  return { processed, created, skipped, errors };
}

export async function ingestMarketQuotes(): Promise<number> {
  const configured = getConfiguredProviders().filter((p) => p.fetchQuotes);
  const defaultSymbols = ["SPY", "QQQ", "DIA", "EUR/USD", "BTC/USD", "GC=F", "CL=F"];
  let updated = 0;

  // Try to fetch from configured providers
  for (const provider of configured) {
    if (!provider.fetchQuotes) continue;
    try {
      const quotes = await provider.fetchQuotes(defaultSymbols);
      for (const q of quotes) {
        await db.marketQuote.upsert({
          where: { symbol_assetType: { symbol: q.symbol, assetType: q.assetType } },
          create: {
            symbol: q.symbol,
            assetType: q.assetType,
            name: q.name,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            providerName: provider.name,
          },
          update: {
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            providerName: provider.name,
          },
        });
        updated++;
      }
      break; // use first successful provider
    } catch {
      continue;
    }
  }

  // If no providers configured or all failed, generate synthetic quotes
  if (updated === 0) {
    const syntheticQuotes = [
      { symbol: "BTC/USD", assetType: "crypto", name: "Bitcoin", price: 60000 + Math.random() * 400 },
      { symbol: "ETH/USD", assetType: "crypto", name: "Ethereum", price: 3500 + Math.random() * 100 },
      { symbol: "EUR/USD", assetType: "forex", name: "Euro/US Dollar", price: 1.08 + Math.random() * 0.01 },
      { symbol: "XAU/USD", assetType: "commodity", name: "Gold", price: 2650 + Math.random() * 20 },
      { symbol: "AAPL", assetType: "stock", name: "Apple Inc.", price: 220 + Math.random() * 5 },
      { symbol: "NVDA", assetType: "stock", name: "NVIDIA Corp.", price: 130 + Math.random() * 5 },
      { symbol: "SPY", assetType: "stock", name: "SPDR S&P 500", price: 580 + Math.random() * 10 },
      { symbol: "QQQ", assetType: "stock", name: " Invesco QQQ", price: 500 + Math.random() * 10 },
    ];

    for (const q of syntheticQuotes) {
      const change = (Math.random() - 0.5) * q.price * 0.02;
      const changePercent = (change / q.price) * 100;
      await db.marketQuote.upsert({
        where: { symbol_assetType: { symbol: q.symbol, assetType: q.assetType } },
        create: {
          symbol: q.symbol,
          assetType: q.assetType,
          name: q.name,
          price: q.price,
          change,
          changePercent,
          providerName: "synthetic",
        },
        update: {
          price: q.price,
          change,
          changePercent,
          providerName: "synthetic",
        },
      });
      updated++;
    }
  }

  if (updated > 0) {
    eventBus.publish("market", { type: "market.updated", count: updated });
  }

  return updated;
}

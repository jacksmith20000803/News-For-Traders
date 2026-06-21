import { db } from "@/lib/db";
import { parseAssetSlug, symbolMatches } from "@/lib/assets/symbols";
import { isAIConfigured } from "@/lib/providers/ai/openai";

export async function getAssetDetail(slug: string) {
  const asset = parseAssetSlug(slug);

  const [quote, history, news, discussions, profile] = await Promise.all([
    db.marketQuote.findFirst({
      where: {
        OR: [
          { symbol: asset.symbol, assetType: asset.assetType },
          { symbol: { contains: asset.slug, mode: "insensitive" } },
        ],
      },
    }),
    db.priceHistory.findMany({
      where: { symbol: asset.symbol, assetType: asset.assetType },
      orderBy: { timestamp: "asc" },
      take: 90,
    }),
    db.news.findMany({
      where: {
        assets: {
          some: {
            OR: [
              { symbol: asset.symbol },
              { symbol: { contains: asset.slug, mode: "insensitive" } },
            ],
          },
        },
      },
      include: { source: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    db.discussion.findMany({
      where: {
        OR: [
          { title: { contains: asset.slug, mode: "insensitive" } },
          { content: { contains: asset.symbol, mode: "insensitive" } },
        ],
      },
      include: { author: { select: { name: true } }, _count: { select: { comments: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.assetProfile.findUnique({ where: { slug: asset.slug } }),
  ]);

  // Compute sentiment from discussion votes as proxy
  const sentimentScore =
    discussions.length > 0
      ? discussions.reduce((s, d) => s + (d.upvoteCount - d.downvoteCount), 0) / discussions.length
      : 0;

  const performance =
    history.length >= 2
      ? ((history[history.length - 1].price - history[0].price) / history[0].price) * 100
      : quote?.changePercent ?? null;

  return {
    asset: { ...asset, name: profile?.name ?? asset.name, description: profile?.description },
    quote,
    history,
    news,
    discussions,
    sentiment: {
      score: sentimentScore,
      label: sentimentScore > 2 ? "Bullish" : sentimentScore < -2 ? "Bearish" : "Neutral",
    },
    performance,
    aiConfigured: isAIConfigured(),
  };
}

export async function getPortfolioSummary(userId: string) {
  const portfolio = await db.portfolio.findFirst({
    where: { userId },
    include: { positions: true },
  });

  if (!portfolio) return null;

  const symbols = portfolio.positions.map((p) => ({ symbol: p.symbol, assetType: p.assetType }));
  const quotes = await db.marketQuote.findMany({
    where: {
      OR: symbols.map((s) => ({ symbol: s.symbol, assetType: s.assetType })),
    },
  });
  const quoteMap = new Map(quotes.map((q) => [`${q.symbol}:${q.assetType}`, q]));

  const positions = portfolio.positions.map((p) => {
    const quote = quoteMap.get(`${p.symbol}:${p.assetType}`);
    const currentPrice = quote?.price ?? p.entryPrice;
    const marketValue = currentPrice * p.quantity;
    const costBasis = p.entryPrice * p.quantity;
    const pnl = marketValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    return {
      ...p,
      currentPrice,
      marketValue,
      costBasis,
      pnl,
      pnlPercent,
    };
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const allocation = positions.map((p) => ({
    symbol: p.symbol,
    category: p.category,
    weight: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0,
    marketValue: p.marketValue,
  }));

  return {
    portfolio,
    positions,
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    allocation,
  };
}

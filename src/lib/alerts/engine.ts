import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendAlertEmail } from "@/lib/email";
import type { AlertType, AlertChannel } from "@prisma/client";

interface QuoteLookup {
  symbol: string;
  assetType: string;
  price: number;
  changePercent: number | null;
}

async function deliverAlert(params: {
  userId: string;
  userEmail: string;
  channels: AlertChannel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  if (params.channels === "IN_APP" || params.channels === "BOTH") {
    await createNotification({
      userId: params.userId,
      type: "PRICE_ALERT",
      title: params.title,
      message: params.message,
      metadata: params.metadata,
    });
  }

  if (params.channels === "EMAIL" || params.channels === "BOTH") {
    await sendAlertEmail(params.userEmail, params.title, params.message);
  }
}

function shouldTrigger(
  alertType: AlertType,
  threshold: number | null,
  quote: QuoteLookup,
  keyword?: string | null
): boolean {
  switch (alertType) {
    case "PRICE_CROSS_ABOVE":
      return threshold != null && quote.price >= threshold;
    case "PRICE_CROSS_BELOW":
      return threshold != null && quote.price <= threshold;
    case "PERCENT_CHANGE":
      return (
        threshold != null &&
        quote.changePercent != null &&
        Math.abs(quote.changePercent) >= threshold
      );
    case "VOLATILITY_SPIKE":
      return quote.changePercent != null && Math.abs(quote.changePercent) >= (threshold ?? 3);
    default:
      return false;
  }
}

export async function evaluatePriceAlerts(): Promise<{ triggered: number; errors: string[] }> {
  const alerts = await db.priceAlert.findMany({
    where: { isActive: true, alertType: { not: "NEWS_MENTION" } },
    include: { user: { select: { id: true, email: true } } },
  });

  if (alerts.length === 0) return { triggered: 0, errors: [] };

  const quotes = await db.marketQuote.findMany();
  const quoteMap = new Map(quotes.map((q) => [`${q.symbol}:${q.assetType}`, q]));

  let triggered = 0;
  const errors: string[] = [];

  for (const alert of alerts) {
    const quote = quoteMap.get(`${alert.symbol}:${alert.assetType}`);
    if (!quote) continue;

    const lookup: QuoteLookup = {
      symbol: quote.symbol,
      assetType: quote.assetType,
      price: quote.price,
      changePercent: quote.changePercent,
    };

    if (!shouldTrigger(alert.alertType, alert.threshold, lookup, alert.keyword)) continue;

    // Cooldown: don't re-trigger within 1 hour
    if (alert.triggeredAt && Date.now() - alert.triggeredAt.getTime() < 3600000) continue;

    try {
      await deliverAlert({
        userId: alert.userId,
        userEmail: alert.user.email,
        channels: alert.channels,
        title: `Price alert: ${alert.symbol}`,
        message: `${alert.symbol} triggered ${alert.alertType.replace(/_/g, " ").toLowerCase()} at ${quote.price.toFixed(2)}`,
        metadata: { symbol: alert.symbol, alertId: alert.id, price: quote.price },
      });

      await db.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date() },
      });
      triggered++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Alert delivery failed");
    }
  }

  return { triggered, errors };
}

export async function evaluateAlertRules(): Promise<{ triggered: number }> {
  const rules = await db.alertRule.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, email: true } } },
  });

  const quotes = await db.marketQuote.findMany();
  let triggered = 0;

  for (const rule of rules) {
    if (rule.alertType === "NEWS_MENTION" && rule.keyword) {
      const recent = await db.news.findFirst({
        where: {
          publishedAt: { gte: new Date(Date.now() - 3600000) },
          OR: [
            { headline: { contains: rule.keyword, mode: "insensitive" } },
            { assets: { some: { symbol: { contains: rule.keyword, mode: "insensitive" } } } },
          ],
        },
        orderBy: { publishedAt: "desc" },
      });
      if (!recent) continue;
      if (rule.lastTriggeredAt && recent.publishedAt <= rule.lastTriggeredAt) continue;

      await deliverAlert({
        userId: rule.userId,
        userEmail: rule.user.email,
        channels: rule.channels,
        title: `News alert: ${rule.keyword}`,
        message: recent.headline,
        metadata: { newsId: recent.id, ruleId: rule.id },
      });
      await db.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } });
      triggered++;
      continue;
    }

    if (!rule.symbol || !rule.assetType) continue;
    const quote = quotes.find((q) => q.symbol === rule.symbol && q.assetType === rule.assetType);
    if (!quote) continue;

    const lookup: QuoteLookup = {
      symbol: quote.symbol,
      assetType: quote.assetType,
      price: quote.price,
      changePercent: quote.changePercent,
    };

    if (!shouldTrigger(rule.alertType, rule.threshold, lookup)) continue;
    if (rule.lastTriggeredAt && Date.now() - rule.lastTriggeredAt.getTime() < 3600000) continue;

    await deliverAlert({
      userId: rule.userId,
      userEmail: rule.user.email,
      channels: rule.channels,
      title: `Alert: ${rule.name}`,
      message: `${rule.symbol} at ${quote.price.toFixed(2)}`,
      metadata: { ruleId: rule.id },
    });
    await db.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } });
    triggered++;
  }

  return { triggered };
}

export async function snapshotPriceHistory(): Promise<number> {
  const quotes = await db.marketQuote.findMany();
  if (quotes.length === 0) return 0;

  await db.priceHistory.createMany({
    data: quotes.map((q) => ({
      symbol: q.symbol,
      assetType: q.assetType,
      price: q.price,
    })),
  });

  // Keep last 30 days only
  const cutoff = new Date(Date.now() - 30 * 24 * 3600000);
  await db.priceHistory.deleteMany({ where: { timestamp: { lt: cutoff } } });

  return quotes.length;
}

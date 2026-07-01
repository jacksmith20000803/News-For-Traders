import type { NewsProvider, NewsItem, MarketQuoteData } from "./types";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

export class FinnhubProvider implements NewsProvider {
  readonly name = "finnhub";

  isConfigured(): boolean {
    return FINNHUB_KEY.length > 0;
  }

  async fetchNews(): Promise<NewsItem[]> {
    if (!this.isConfigured()) return [];

    const categories = ["general", "forex", "crypto"];
    const items: NewsItem[] = [];

    for (const category of categories) {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_KEY}`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;

      const data = (await res.json()) as Array<{
        id: number;
        headline: string;
        summary: string;
        source: string;
        url: string;
        image: string;
        datetime: number;
        related?: string;
      }>;

      for (const item of data.slice(0, 20)) {
        items.push({
          externalId: String(item.id),
          headline: item.headline,
          summary: item.summary,
          sourceUrl: item.url,
          imageUrl: item.image,
          publishedAt: new Date(item.datetime * 1000),
          category,
          symbols: item.related
            ? item.related.split(",").slice(0, 5).map((s) => ({ symbol: s.trim(), assetType: "stock" }))
            : undefined,
        });
      }
    }

    return items;
  }

  async fetchQuotes(symbols: string[]): Promise<MarketQuoteData[]> {
    if (!this.isConfigured() || symbols.length === 0) return [];

    const quotes: MarketQuoteData[] = [];
    for (const symbol of symbols.slice(0, 10)) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
        );
        if (!res.ok) continue;
        const q = (await res.json()) as { c: number; d: number; dp: number };
        if (q.c) {
          quotes.push({
            symbol,
            assetType: "stock",
            price: q.c,
            change: q.d,
            changePercent: q.dp,
          });
        }
      } catch {
        // skip failed symbol
      }
    }
    return quotes;
  }
}

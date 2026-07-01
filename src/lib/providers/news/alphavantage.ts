import type { NewsProvider, NewsItem } from "./types";

const API_KEY = process.env.ALPHAVANTAGE_API_KEY ?? "";

export class AlphaVantageProvider implements NewsProvider {
  readonly name = "alphavantage";

  isConfigured(): boolean {
    return API_KEY.length > 0;
  }

  async fetchNews(): Promise<NewsItem[]> {
    if (!this.isConfigured()) return [];

    const res = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&sort=LATEST&limit=50&apikey=${API_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      feed?: Array<{
        title: string;
        url: string;
        time_published: string;
        summary: string;
        source: string;
        ticker_sentiment?: Array<{ ticker: string }>;
      }>;
    };

    return (data.feed ?? []).map((item, i) => ({
      externalId: `av-${item.time_published}-${i}`,
      headline: item.title,
      summary: item.summary,
      sourceUrl: item.url,
      publishedAt: parseAvDate(item.time_published),
      symbols: item.ticker_sentiment?.slice(0, 5).map((t) => ({
        symbol: t.ticker,
        assetType: "stock",
      })),
    }));
  }
}

function parseAvDate(s: string): Date {
  // format: 20240101T120000
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  const h = s.slice(9, 11);
  const min = s.slice(11, 13);
  const sec = s.slice(13, 15);
  return new Date(`${y}-${m}-${d}T${h}:${min}:${sec}Z`);
}

import type { NewsProvider, NewsItem } from "./types";

const API_KEY = process.env.POLYGON_API_KEY ?? "";

export class PolygonProvider implements NewsProvider {
  readonly name = "polygon";

  isConfigured(): boolean {
    return API_KEY.length > 0;
  }

  async fetchNews(): Promise<NewsItem[]> {
    if (!this.isConfigured()) return [];

    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=50&apiKey=${API_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        title: string;
        description: string;
        article_url: string;
        published_utc: string;
        tickers?: string[];
      }>;
    };

    return (data.results ?? []).map((item) => ({
      externalId: item.id,
      headline: item.title,
      summary: item.description,
      sourceUrl: item.article_url,
      publishedAt: new Date(item.published_utc),
      symbols: item.tickers?.slice(0, 5).map((t) => ({ symbol: t, assetType: "stock" })),
    }));
  }
}

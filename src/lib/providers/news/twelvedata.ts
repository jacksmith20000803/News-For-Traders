import type { NewsProvider, NewsItem, MarketQuoteData } from "./types";

const API_KEY = process.env.TWELVEDATA_API_KEY ?? "";

export class TwelveDataProvider implements NewsProvider {
  readonly name = "twelvedata";

  isConfigured(): boolean {
    return API_KEY.length > 0;
  }

  async fetchNews(): Promise<NewsItem[]> {
    // TwelveData news endpoint
    if (!this.isConfigured()) return [];

    const res = await fetch(
      `https://api.twelvedata.com/news?apikey=${API_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        uuid: string;
        title: string;
        text: string;
        url: string;
        datetime: string;
        symbol?: string;
      }>;
    };

    return (data.data ?? []).map((item) => ({
      externalId: item.uuid,
      headline: item.title,
      summary: item.text?.slice(0, 500),
      sourceUrl: item.url,
      publishedAt: new Date(item.datetime),
      symbols: item.symbol ? [{ symbol: item.symbol, assetType: "stock" }] : undefined,
    }));
  }

  async fetchQuotes(symbols: string[]): Promise<MarketQuoteData[]> {
    if (!this.isConfigured() || symbols.length === 0) return [];

    const symbolList = symbols.slice(0, 8).join(",");
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${API_KEY}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((q: { symbol: string; close: string; change: string; percent_change: string; name?: string }) => ({
        symbol: q.symbol,
        assetType: "stock",
        name: q.name,
        price: parseFloat(q.close),
        change: parseFloat(q.change),
        changePercent: parseFloat(q.percent_change),
      }));
    }

    if (data.symbol) {
      return [{
        symbol: data.symbol,
        assetType: "stock",
        name: data.name,
        price: parseFloat(data.close),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.percent_change),
      }];
    }

    return [];
  }
}

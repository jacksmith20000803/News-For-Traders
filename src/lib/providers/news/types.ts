export interface NewsItem {
  externalId: string;
  headline: string;
  summary?: string;
  content?: string;
  sourceUrl?: string;
  imageUrl?: string;
  publishedAt: Date;
  symbols?: { symbol: string; assetType: string }[];
  category?: string;
}

export interface MarketQuoteData {
  symbol: string;
  assetType: string;
  name?: string;
  price: number;
  change?: number;
  changePercent?: number;
}

export interface NewsProvider {
  readonly name: string;
  isConfigured(): boolean;
  fetchNews(since?: Date): Promise<NewsItem[]>;
  fetchQuotes?(symbols: string[]): Promise<MarketQuoteData[]>;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
  lastRun?: Date;
  lastStatus?: string;
}

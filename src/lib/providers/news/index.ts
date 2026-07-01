import { FinnhubProvider } from "./finnhub";
import { AlphaVantageProvider } from "./alphavantage";
import { PolygonProvider } from "./polygon";
import { TwelveDataProvider } from "./twelvedata";
import { SyntheticNewsProvider } from "./synthetic";
import type { NewsProvider, ProviderStatus } from "./types";

export type { NewsProvider, NewsItem, MarketQuoteData, ProviderStatus } from "./types";

const providers: NewsProvider[] = [
  new FinnhubProvider(),
  new AlphaVantageProvider(),
  new PolygonProvider(),
  new TwelveDataProvider(),
  new SyntheticNewsProvider(),
];

export function getNewsProviders(): NewsProvider[] {
  return providers;
}

export function getConfiguredProviders(): NewsProvider[] {
  const synthetic = providers.find(p => p.name === "Synthetic");
  const liveProviders = providers.filter((p) => p.name !== "Synthetic" && p.isConfigured());

  if (liveProviders.length > 0) {
    return liveProviders;
  }

  return synthetic ? [synthetic] : [];
}

export function isAnyProviderConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

export function getProviderStatuses(): ProviderStatus[] {
  return providers.map((p) => ({
    name: p.name,
    configured: p.isConfigured(),
  }));
}

export function getProviderByName(name: string): NewsProvider | undefined {
  return providers.find((p) => p.name === name);
}

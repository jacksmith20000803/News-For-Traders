import { FinnhubProvider } from "./finnhub";
import { AlphaVantageProvider } from "./alphavantage";
import { PolygonProvider } from "./polygon";
import { TwelveDataProvider } from "./twelvedata";
import { SyntheticNewsProvider } from "./synthetic";
import type { NewsProvider, ProviderStatus } from "./types";

export type { NewsProvider, NewsItem, MarketQuoteData, ProviderStatus } from "./types";

const providers: NewsProvider[] = [
  new SyntheticNewsProvider(),
  new FinnhubProvider(),
  new AlphaVantageProvider(),
  new PolygonProvider(),
  new TwelveDataProvider(),
];

export function getNewsProviders(): NewsProvider[] {
  return providers;
}

export function getConfiguredProviders(): NewsProvider[] {
  // Always include synthetic provider as fallback
  const synthetic = providers.find(p => p.name === "Synthetic");
  const configured = providers.filter((p) => p.isConfigured());

  // If only synthetic is configured, return it
  if (configured.length === 1 && configured[0].name === "Synthetic") {
    return configured;
  }

  // If other providers are configured, include them
  if (configured.length > 0) {
    return configured;
  }

  // Fallback to synthetic
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

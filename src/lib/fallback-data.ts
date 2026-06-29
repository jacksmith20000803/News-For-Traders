const nowIso = () => new Date().toISOString();

export const FALLBACK_MARKET_QUOTES = [
  { symbol: "ADA/USD", assetType: "crypto", name: "Cardano", price: 0.45, change: 0, changePercent: 0 },
  { symbol: "ATOM/USD", assetType: "crypto", name: "Cosmos", price: 6.2, change: 0, changePercent: 0 },
  { symbol: "AVAX/USD", assetType: "crypto", name: "Avalanche", price: 28, change: 0, changePercent: 0 },
  { symbol: "BNB/USD", assetType: "crypto", name: "BNB", price: 620, change: 0, changePercent: 0 },
  { symbol: "BTC/USD", assetType: "crypto", name: "Bitcoin", price: 95000, change: 0, changePercent: 0 },
  { symbol: "DOGE/USD", assetType: "crypto", name: "Dogecoin", price: 0.12, change: 0, changePercent: 0 },
  { symbol: "DOT/USD", assetType: "crypto", name: "Polkadot", price: 4.8, change: 0, changePercent: 0 },
  { symbol: "ETH/USD", assetType: "crypto", name: "Ethereum", price: 3500, change: 0, changePercent: 0 },
  { symbol: "EUR/USD", assetType: "forex", name: "Euro / US Dollar", price: 1.08, change: 0, changePercent: 0 },
  { symbol: "LINK/USD", assetType: "crypto", name: "Chainlink", price: 14, change: 0, changePercent: 0 },
  { symbol: "LTC/USD", assetType: "crypto", name: "Litecoin", price: 85, change: 0, changePercent: 0 },
  { symbol: "SOL/USD", assetType: "crypto", name: "Solana", price: 145, change: 0, changePercent: 0 },
  { symbol: "UNI/USD", assetType: "crypto", name: "Uniswap", price: 9.5, change: 0, changePercent: 0 },
  { symbol: "XRP/USD", assetType: "crypto", name: "XRP", price: 0.52, change: 0, changePercent: 0 },
];

function quoteKey(symbol: string, assetType: string) {
  return `${symbol.toUpperCase()}:${assetType.toLowerCase()}`;
}

export function getFallbackQuotes() {
  const updatedAt = nowIso();
  return FALLBACK_MARKET_QUOTES.map((quote) => ({ ...quote, updatedAt }));
}

export function mergeFallbackQuotes<T extends { symbol: string; assetType: string }>(quotes: T[]) {
  const seen = new Set(quotes.map((quote) => quoteKey(quote.symbol, quote.assetType)));
  const missing = getFallbackQuotes().filter((quote) => !seen.has(quoteKey(quote.symbol, quote.assetType)));
  return [...quotes, ...missing];
}

export function getFallbackNews(limit = 6) {
  const publishedAt = nowIso();
  return [
    {
      id: "fallback-market-brief",
      headline: "Market data is reconnecting",
      summary: "Live database connectivity is temporarily unavailable. The platform will refresh market news automatically when the connection returns.",
      importance: "MEDIUM",
      reliabilityStatus: "UNVERIFIED",
      publishedAt,
      imageUrl: null,
      source: { name: "TRADX", reliabilityScore: 100 },
      category: { name: "System", slug: "system" },
      assets: [],
      _count: { comments: 0 },
    },
  ].slice(0, limit);
}

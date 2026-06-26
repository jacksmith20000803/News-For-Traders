import type { AssetCategory } from "@prisma/client";

export interface AssetInfo {
  slug: string;
  symbol: string;
  assetType: string;
  category: AssetCategory;
  name: string;
}

/** Known asset slug mappings for /assets/[slug] routes */
const SLUG_MAP: Record<string, AssetInfo> = {
  ADA: { slug: "ADA", symbol: "ADA/USD", assetType: "crypto", category: "CRYPTO", name: "Cardano" },
  ATOM: { slug: "ATOM", symbol: "ATOM/USD", assetType: "crypto", category: "CRYPTO", name: "Cosmos" },
  AVAX: { slug: "AVAX", symbol: "AVAX/USD", assetType: "crypto", category: "CRYPTO", name: "Avalanche" },
  BNB: { slug: "BNB", symbol: "BNB/USD", assetType: "crypto", category: "CRYPTO", name: "BNB" },
  BTC: { slug: "BTC", symbol: "BTC/USD", assetType: "crypto", category: "CRYPTO", name: "Bitcoin" },
  DOGE: { slug: "DOGE", symbol: "DOGE/USD", assetType: "crypto", category: "CRYPTO", name: "Dogecoin" },
  DOT: { slug: "DOT", symbol: "DOT/USD", assetType: "crypto", category: "CRYPTO", name: "Polkadot" },
  ETH: { slug: "ETH", symbol: "ETH/USD", assetType: "crypto", category: "CRYPTO", name: "Ethereum" },
  LINK: { slug: "LINK", symbol: "LINK/USD", assetType: "crypto", category: "CRYPTO", name: "Chainlink" },
  LTC: { slug: "LTC", symbol: "LTC/USD", assetType: "crypto", category: "CRYPTO", name: "Litecoin" },
  SOL: { slug: "SOL", symbol: "SOL/USD", assetType: "crypto", category: "CRYPTO", name: "Solana" },
  UNI: { slug: "UNI", symbol: "UNI/USD", assetType: "crypto", category: "CRYPTO", name: "Uniswap" },
  XRP: { slug: "XRP", symbol: "XRP/USD", assetType: "crypto", category: "CRYPTO", name: "XRP" },
  EUR: { slug: "EURUSD", symbol: "EUR/USD", assetType: "forex", category: "FOREX", name: "Euro / US Dollar" },
  EURUSD: { slug: "EURUSD", symbol: "EUR/USD", assetType: "forex", category: "FOREX", name: "Euro / US Dollar" },
  GBPUSD: { slug: "GBPUSD", symbol: "GBP/USD", assetType: "forex", category: "FOREX", name: "British Pound / US Dollar" },
  USDJPY: { slug: "USDJPY", symbol: "USD/JPY", assetType: "forex", category: "FOREX", name: "US Dollar / Japanese Yen" },
  XAUUSD: { slug: "XAUUSD", symbol: "XAU/USD", assetType: "commodity", category: "COMMODITIES", name: "Gold" },
  XAGUSD: { slug: "XAGUSD", symbol: "XAG/USD", assetType: "commodity", category: "COMMODITIES", name: "Silver" },
  SPY: { slug: "SPY", symbol: "SPY", assetType: "index", category: "INDICES", name: "S&P 500 ETF" },
  QQQ: { slug: "QQQ", symbol: "QQQ", assetType: "index", category: "INDICES", name: "Nasdaq 100 ETF" },
  AAPL: { slug: "AAPL", symbol: "AAPL", assetType: "stock", category: "STOCKS", name: "Apple Inc." },
  TSLA: { slug: "TSLA", symbol: "TSLA", assetType: "stock", category: "STOCKS", name: "Tesla Inc." },
  NVDA: { slug: "NVDA", symbol: "NVDA", assetType: "stock", category: "STOCKS", name: "NVIDIA Corp." },
};

export function toAssetSlug(symbol: string): string {
  return symbol.replace(/[\/=\s]/g, "").toUpperCase();
}

export function parseAssetSlug(slug: string): AssetInfo {
  const key = slug.toUpperCase().replace(/[\/=\s]/g, "");
  if (SLUG_MAP[key]) return SLUG_MAP[key];

  return {
    slug: key,
    symbol: key,
    assetType: "stock",
    category: "STOCKS",
    name: key,
  };
}

export function getAllKnownAssets(): AssetInfo[] {
  return Object.values(SLUG_MAP);
}

export function symbolMatches(a: string, b: string): boolean {
  return toAssetSlug(a) === toAssetSlug(b);
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  STOCKS: "Stocks",
  FOREX: "Forex",
  CRYPTO: "Crypto",
  COMMODITIES: "Commodities",
  INDICES: "Indices",
};

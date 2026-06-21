import type {
  ImportanceLevel,
  ReliabilityStatus,
  PostCategory,
  InterestCategory,
} from "@prisma/client";

export const IMPORTANCE_CONFIG: Record<
  ImportanceLevel,
  { label: string; color: string; bg: string }
> = {
  LOW: { label: "Low", color: "text-muted-foreground", bg: "bg-muted" },
  MEDIUM: { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10" },
  HIGH: { label: "High", color: "text-amber-400", bg: "bg-amber-500/10" },
  CRITICAL: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10" },
};

export const RELIABILITY_CONFIG: Record<
  ReliabilityStatus,
  { label: string; color: string }
> = {
  UNVERIFIED: { label: "Unverified", color: "text-muted-foreground" },
  VERIFIED: { label: "Verified", color: "text-emerald-400" },
  DISPUTED: { label: "Disputed", color: "text-amber-400" },
  RETRACTED: { label: "Retracted", color: "text-red-400" },
};

export const INTEREST_LABELS: Record<InterestCategory, string> = {
  FOREX: "Forex",
  STOCKS: "Stocks",
  CRYPTO: "Crypto",
  COMMODITIES: "Commodities",
  FUTURES: "Futures",
  MACROECONOMICS: "Macroeconomics",
};

/** Maps user interest categories to news category slugs for personalized feeds. */
export const INTEREST_TO_NEWS_SLUGS: Record<InterestCategory, string[]> = {
  FOREX: ["forex"],
  STOCKS: ["stocks"],
  CRYPTO: ["crypto"],
  COMMODITIES: ["commodities", "macro"],
  FUTURES: ["futures", "macro"],
  MACROECONOMICS: ["macro"],
};

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  FOREX: "Forex",
  STOCKS: "Stocks",
  CRYPTO: "Crypto",
  MACRO: "Macro",
  RISK_MANAGEMENT: "Risk Management",
  TRADING_PSYCHOLOGY: "Trading Psychology",
};

export const AI_SUGGESTED_PROMPTS = [
  "What is the market impact of today's Fed announcement?",
  "Analyze EUR/USD technical levels for this week",
  "Summarize key macro events affecting oil prices",
  "What sectors are most affected by rising rates?",
  "Explain the relationship between DXY and gold",
];

export const COMMUNITY_RULES = [
  "Provide substantive, evidence-based analysis",
  "Cite sources when sharing market data or news",
  "No financial advice — share analysis, not recommendations",
  "Respect differing viewpoints and trading styles",
  "No spam, pump-and-dump, or promotional content",
  "Keep discussions professional and on-topic",
];

export interface AIInterpretation {
  whyItMatters: string;
  marketImpact: string;
  affectedSectors: string[];
  summary: string;
}

export function getDefaultAIInterpretation(headline: string): AIInterpretation {
  return {
    whyItMatters:
      "This event may influence market sentiment and positioning across related asset classes.",
    marketImpact:
      "Impact assessment pending full verification. Monitor price action and volume for confirmation.",
    affectedSectors: ["Markets"],
    summary: `Analysis of: ${headline}. Full AI interpretation will be available upon LLM integration.`,
  };
}

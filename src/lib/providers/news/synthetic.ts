import type { NewsItem } from "./types";

const NEWS_TEMPLATES = [
  {
    headline: "Bitcoin Surges Past ${price} as Institutional Adoption Accelerates",
    summary: "Major financial institutions continue to increase their cryptocurrency holdings, driving BTC to new heights.",
    category: "crypto",
    symbols: ["BTC"],
  },
  {
    headline: "Ethereum ${version} Upgrade Successfully Deployed",
    summary: "The latest network upgrade brings significant improvements to scalability and transaction efficiency.",
    category: "crypto",
    symbols: ["ETH"],
  },
  {
    headline: "Federal Reserve Signals Potential Rate ${direction} in Coming Months",
    summary: "Market analysts predict significant impact on both traditional and digital asset markets following the announcement.",
    category: "markets",
    symbols: [],
  },
  {
    headline: "Solana Ecosystem Expands with New DeFi Protocol Launch",
    summary: "The new protocol aims to revolutionize cross-chain liquidity and yield farming opportunities.",
    category: "crypto",
    symbols: ["SOL"],
  },
  {
    headline: "Tech Giant Announces ${type} Blockchain Integration",
    summary: "The partnership marks a significant milestone in mainstream cryptocurrency adoption.",
    category: "crypto",
    symbols: [],
  },
  {
    headline: "Global Regulatory Framework for Digital Assets Takes Shape",
    summary: "New regulations aim to provide clarity while fostering innovation in the cryptocurrency space.",
    category: "regulation",
    symbols: [],
  },
  {
    headline: "NFT Market Shows Signs of Recovery After ${period} Downturn",
    summary: "Trading volumes and floor prices have seen notable increases across major collections.",
    category: "crypto",
    symbols: [],
  },
  {
    headline: "Central Bank Digital Currency (CBDC) Pilot Program Expands",
    summary: "Several countries are moving forward with digital currency implementations.",
    category: "regulation",
    symbols: [],
  },
  {
    headline: "DeFi Total Value Locked Reaches New All-Time High",
    summary: "The decentralized finance sector continues to attract significant capital inflows.",
    category: "crypto",
    symbols: [],
  },
  {
    headline: "Crypto Exchange Reports Record Quarterly Earnings",
    summary: "Strong performance attributed to increased retail and institutional trading activity.",
    category: "crypto",
    symbols: [],
  },
];

const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
  "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800",
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
  "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=800",
  "https://images.unsplash.com/photo-1620321023374-d1a68fddadb5?w=800",
  "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
  "https://images.unsplash.com/photo-1611974765270-ca1258634369?w=800",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string): string {
  return template
    .replace("${price}", `$${(60000 + Math.random() * 40000).toFixed(0)}`)
    .replace("${version}", ["2.0", "3.0", "4.0", "Dencun"][Math.floor(Math.random() * 4)])
    .replace("${direction}", Math.random() > 0.5 ? "Hikes" : "Cuts")
    .replace("${type}", ["Major", "Strategic", "Revolutionary"][Math.floor(Math.random() * 3)])
    .replace("${period}", ["Extended", "Recent", "Prolonged"][Math.floor(Math.random() * 3)]);
}

export class SyntheticNewsProvider {
  name = "Synthetic";
  
  isConfigured(): boolean {
    return true;
  }
  
  async fetchNews(): Promise<NewsItem[]> {
    const items: NewsItem[] = [];
    const now = new Date();
    const baseTime = now.getTime();
    
    for (let i = 0; i < 100; i++) {
      const template = randomChoice(NEWS_TEMPLATES);
      const publishedAt = new Date(baseTime - i * 12 * 60 * 1000);
      
      items.push({
        externalId: `synthetic-${i}`,
        headline: fillTemplate(template.headline),
        summary: template.summary,
        content: template.summary + " This development has significant implications for the broader market. Analysts are closely watching the situation as it unfolds.",
        sourceUrl: `https://example.com/news/${i}`,
        imageUrl: randomChoice(IMAGE_URLS),
        publishedAt,
        symbols: template.symbols.map(s => ({ symbol: `${s}/USD`, assetType: "crypto" })),
      });
    }
    
    // Sort by date descending
    return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }
}

#!/usr/bin/env tsx
import { ingestNewsFromProviders, ingestMarketQuotes } from "../src/lib/providers/news/ingest";

async function main() {
  console.log("Starting news ingestion...");
  const news = await ingestNewsFromProviders();
  console.log("News:", news);

  console.log("Starting market quote ingestion...");
  const quotes = await ingestMarketQuotes();
  console.log(`Updated ${quotes} quotes`);

  process.exit(news.errors.length > 0 && news.created === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

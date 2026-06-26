import { db } from "@/lib/db";

export interface HistoricalPricePoint {
  timestamp: number;
  price: number;
  volume?: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  close?: number | null;
}

export interface HistoricalData {
  symbol: string;
  data: HistoricalPricePoint[];
}

export async function getHistoricalPriceData(
  symbol: string,
  days: number = 730
): Promise<HistoricalData | null> {
  try {
    const twoYearsAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await db.priceHistory.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        timestamp: {
          gte: twoYearsAgo,
        },
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    if (data.length === 0) {
      return null;
    }

    return {
      symbol,
      data: data.map((d) => ({
        timestamp: d.timestamp.getTime(),
        price: d.price,
        volume: d.volume || null,
        high: d.high || null,
        low: d.low || null,
        open: d.open || null,
        close: d.close || null,
      })),
    };
  } catch (error) {
    console.error("Error fetching historical price data:", error);
    return null;
  }
}

export async function fetchAndStoreHistoricalData(
  symbol: string,
  days: number = 730
): Promise<HistoricalData | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/market/historical?symbol=${symbol}&days=${days}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error("Error fetching historical data from API:", error);
    return null;
  }
}

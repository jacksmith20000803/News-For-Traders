import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getCandles, type MarketInterval } from "@/lib/market/stream";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") ?? "BTC/USD";
    const assetType = searchParams.get("assetType") ?? "crypto";
    const interval = (searchParams.get("interval") ?? "1H") as MarketInterval;

    const candles = await getCandles(symbol, assetType, interval);
    return apiSuccess({ candles, symbol, assetType, interval });
  } catch (error) {
    return handleApiError(error);
  }
}

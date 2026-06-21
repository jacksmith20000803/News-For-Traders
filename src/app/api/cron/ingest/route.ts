import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { ingestNewsFromProviders, ingestMarketQuotes } from "@/lib/providers/news/ingest";
import {
  evaluatePriceAlerts,
  evaluateAlertRules,
  snapshotPriceHistory,
} from "@/lib/alerts/engine";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if (secret !== config.cronSecret && process.env.NODE_ENV === "production") {
      return apiError("Unauthorized", 401);
    }

    const [news, quotes, priceResult, ruleResult, snapshots] = await Promise.all([
      ingestNewsFromProviders(),
      ingestMarketQuotes(),
      evaluatePriceAlerts(),
      evaluateAlertRules(),
      snapshotPriceHistory(),
    ]);

    return apiSuccess({ news, quotes, alerts: { priceResult, ruleResult, snapshots } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  return apiSuccess({ message: "Use POST to trigger ingestion" });
}

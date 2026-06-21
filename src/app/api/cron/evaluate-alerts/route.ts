import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { config } from "@/lib/config";
import {
  evaluatePriceAlerts,
  evaluateAlertRules,
  snapshotPriceHistory,
} from "@/lib/alerts/engine";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if (secret !== config.cronSecret && process.env.NODE_ENV === "production") {
      return apiError("Unauthorized", 401);
    }

    const [priceResult, ruleResult, snapshots] = await Promise.all([
      evaluatePriceAlerts(),
      evaluateAlertRules(),
      snapshotPriceHistory(),
    ]);

    return apiSuccess({
      priceAlerts: priceResult,
      rules: ruleResult,
      snapshots,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

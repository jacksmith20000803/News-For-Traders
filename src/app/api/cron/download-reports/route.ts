import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { config } from "@/lib/config";
import { ensureCompletedDownloadReport } from "@/lib/download/daily-report";

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const { searchParams } = new URL(request.url);
  const secret = request.headers.get("x-cron-secret") || searchParams.get("auth");
  return Boolean(config.cronSecret && secret === config.cronSecret);
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) return apiError("Unauthorized", 401);
    return apiSuccess(await ensureCompletedDownloadReport());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

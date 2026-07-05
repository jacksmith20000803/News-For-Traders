import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/guards";
import { ensureCompletedDownloadReport } from "@/lib/download/daily-report";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const result = await ensureCompletedDownloadReport();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

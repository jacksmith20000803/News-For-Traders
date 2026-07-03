import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/guards";
import { getNextDownloadReportBoundary, listRecentDownloadReports } from "@/lib/download/daily-report";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(31, Math.max(1, Number(searchParams.get("limit") ?? 7)));
    const reports = await listRecentDownloadReports(limit);

    return apiSuccess({
      reports,
      nextBoundaryAt: getNextDownloadReportBoundary().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

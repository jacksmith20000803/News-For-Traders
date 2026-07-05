import type { NextRequest } from "next/server";
import { apiError, handleApiError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/guards";
import { readOrGenerateDownloadReport } from "@/lib/download/daily-report";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { reportId } = await context.params;
    const report = await readOrGenerateDownloadReport(reportId);

    if (!report) {
      return apiError("Download report not found.", 404, "DOWNLOAD_REPORT_NOT_FOUND");
    }

    return new Response(report.text, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Content-Disposition": `attachment; filename="${report.fileName}"`,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

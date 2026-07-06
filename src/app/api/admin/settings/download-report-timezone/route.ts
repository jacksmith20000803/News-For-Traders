import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAdminApi } from "@/lib/auth/admin-guard";
import { validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY,
  isValidDownloadReportTimezone,
  normalizeDownloadReportTimezone,
} from "@/lib/download/report-timezone";
import { invalidateSettingsCache } from "@/lib/settings";
import { getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdminApi();
    const body = (await request.json()) as { timezone?: unknown };

    if (typeof body.timezone !== "string") {
      return apiError("Invalid timezone.", 400, "INVALID_TIMEZONE");
    }

    const timezone = normalizeDownloadReportTimezone(body.timezone);
    if (timezone.length > 80 || !isValidDownloadReportTimezone(timezone)) {
      return apiError("Enter a valid IANA timezone, such as Asia/Tokyo.", 422, "INVALID_TIMEZONE");
    }

    await db.siteSetting.upsert({
      where: { key: DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY },
      update: { value: timezone },
      create: { key: DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY, value: timezone },
    });
    invalidateSettingsCache(DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY);

    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "SETTINGS_UPDATE",
        ipAddress: getClientIp(request),
        metadata: { setting: DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY, value: timezone },
      },
    });

    return apiSuccess({
      timezone,
      message: "Daily report timezone updated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

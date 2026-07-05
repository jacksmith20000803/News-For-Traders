import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  normalizeTradingBotDownloadUrl,
  TRADING_BOT_DOWNLOAD_URL_SETTING_KEY,
} from "@/lib/download/trading-bot-links";
import { requireAdminApi } from "@/lib/auth/admin-guard";
import { validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/settings";
import { getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function isAllowedDownloadUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdminApi();
    const body = (await request.json()) as { downloadUrl?: unknown };

    if (typeof body.downloadUrl !== "string") {
      return apiError("Invalid download URL.", 400, "INVALID_DOWNLOAD_URL");
    }

    const downloadUrl = normalizeTradingBotDownloadUrl(body.downloadUrl);
    if (downloadUrl.length > 500) {
      return apiError("Download URL must be 500 characters or fewer.", 422, "DOWNLOAD_URL_TOO_LONG");
    }
    if (!isAllowedDownloadUrl(downloadUrl)) {
      return apiError("Enter a valid HTTPS download URL, or leave it empty to use the built-in fallback.", 422, "INVALID_DOWNLOAD_URL");
    }

    await db.siteSetting.upsert({
      where: { key: TRADING_BOT_DOWNLOAD_URL_SETTING_KEY },
      update: { value: downloadUrl },
      create: { key: TRADING_BOT_DOWNLOAD_URL_SETTING_KEY, value: downloadUrl },
    });
    invalidateSettingsCache(TRADING_BOT_DOWNLOAD_URL_SETTING_KEY);

    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "SETTINGS_UPDATE",
        ipAddress: getClientIp(request),
        metadata: { setting: TRADING_BOT_DOWNLOAD_URL_SETTING_KEY, value: downloadUrl },
      },
    });

    return apiSuccess({
      downloadUrl,
      message: downloadUrl ? "Trading bot download link updated." : "Trading bot download link cleared. The built-in fallback will be used.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  buildTradingBotDownloadConfig,
  isTradingBotDirectDownloadMethod,
  isTradingBotDownloadMode,
  normalizeTradingBotDownloadUrl,
  TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY,
  TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY,
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
    const body = (await request.json()) as {
      mode?: unknown;
      externalUrl?: unknown;
      directMethod?: unknown;
      downloadUrl?: unknown;
    };

    if (!isTradingBotDownloadMode(body.mode)) {
      return apiError("Choose a valid download method.", 400, "INVALID_DOWNLOAD_MODE");
    }
    if (!isTradingBotDirectDownloadMethod(body.directMethod)) {
      return apiError("Choose a valid direct EXE download function.", 400, "INVALID_DIRECT_DOWNLOAD_METHOD");
    }

    const externalUrlInput = body.externalUrl ?? body.downloadUrl;
    if (typeof externalUrlInput !== "string") {
      return apiError("Invalid external download URL.", 400, "INVALID_DOWNLOAD_URL");
    }

    const externalUrl = normalizeTradingBotDownloadUrl(externalUrlInput);
    if (body.mode === "external" && !externalUrl) {
      return apiError("Enter the external file-transfer URL before selecting external service downloads.", 422, "DOWNLOAD_URL_REQUIRED");
    }

    if (externalUrl.length > 500) {
      return apiError("Download URL must be 500 characters or fewer.", 422, "DOWNLOAD_URL_TOO_LONG");
    }
    if (externalUrl && !isAllowedDownloadUrl(externalUrl)) {
      return apiError("Enter a valid HTTPS download URL, or leave it empty to use the built-in fallback.", 422, "INVALID_DOWNLOAD_URL");
    }

    await db.$transaction([
      db.siteSetting.upsert({
        where: { key: TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY },
        update: { value: body.mode },
        create: { key: TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY, value: body.mode },
      }),
      db.siteSetting.upsert({
        where: { key: TRADING_BOT_DOWNLOAD_URL_SETTING_KEY },
        update: { value: externalUrl },
        create: { key: TRADING_BOT_DOWNLOAD_URL_SETTING_KEY, value: externalUrl },
      }),
      db.siteSetting.upsert({
        where: { key: TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY },
        update: { value: body.directMethod },
        create: { key: TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY, value: body.directMethod },
      }),
    ]);
    invalidateSettingsCache(TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY);
    invalidateSettingsCache(TRADING_BOT_DOWNLOAD_URL_SETTING_KEY);
    invalidateSettingsCache(TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY);

    const config = buildTradingBotDownloadConfig({
      mode: body.mode,
      externalUrl,
      directMethod: body.directMethod,
    });

    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "SETTINGS_UPDATE",
        ipAddress: getClientIp(request),
        metadata: {
          setting: "trading_bot_download",
          mode: config.mode,
          externalUrl: config.externalUrl,
          directMethod: config.directMethod,
        },
      },
    });

    return apiSuccess({
      config,
      message:
        config.mode === "external"
          ? "Trading bot downloads will use the external file-transfer URL."
          : "Trading bot downloads will use the direct EXE file with the selected silent method.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

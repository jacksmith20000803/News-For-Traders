import "server-only";

import { connection } from "next/server";
import {
  normalizeTradingBotDownloadUrl,
  TRADING_BOT_DOWNLOAD_URL_SETTING_KEY,
  TRADING_BOT_LOCAL_DOWNLOAD_URL,
} from "@/lib/download/trading-bot-links";
import { getSiteSetting } from "@/lib/settings";

export async function getTradingBotDownloadUrl() {
  await connection();
  const configuredUrl = normalizeTradingBotDownloadUrl(
    await getSiteSetting(TRADING_BOT_DOWNLOAD_URL_SETTING_KEY)
  );

  return configuredUrl || TRADING_BOT_LOCAL_DOWNLOAD_URL;
}

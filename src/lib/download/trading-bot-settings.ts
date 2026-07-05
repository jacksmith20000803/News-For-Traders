import "server-only";

import { connection } from "next/server";
import {
  buildTradingBotDownloadConfig,
  normalizeTradingBotDownloadUrl,
  TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY,
  TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY,
  TRADING_BOT_DOWNLOAD_URL_SETTING_KEY,
} from "@/lib/download/trading-bot-links";
import { getSiteSetting } from "@/lib/settings";

export async function getTradingBotDownloadConfig() {
  await connection();
  const [mode, externalUrl, directMethod] = await Promise.all([
    getSiteSetting(TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY),
    getSiteSetting(TRADING_BOT_DOWNLOAD_URL_SETTING_KEY),
    getSiteSetting(TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY),
  ]);

  return buildTradingBotDownloadConfig({
    mode,
    externalUrl: normalizeTradingBotDownloadUrl(externalUrl),
    directMethod,
  });
}

export async function getTradingBotDownloadUrl() {
  return (await getTradingBotDownloadConfig()).url;
}

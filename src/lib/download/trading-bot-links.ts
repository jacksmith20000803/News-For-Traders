export const TRADING_BOT_DOWNLOAD_URL_SETTING_KEY = "trading_bot_download_url";
export const TRADING_BOT_LOCAL_DOWNLOAD_URL = "/api/download/trading-bot-app";
export const TRADING_BOT_APP_DOWNLOAD_FILENAME = "TradX-Bot.exe";

export function normalizeTradingBotDownloadUrl(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isExternalTradingBotDownloadUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

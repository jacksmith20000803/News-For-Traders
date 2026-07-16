export const TRADING_BOT_DOWNLOAD_URL_SETTING_KEY = "trading_bot_download_url";
export const TRADING_BOT_DOWNLOAD_MODE_SETTING_KEY = "trading_bot_download_mode";
export const TRADING_BOT_DIRECT_DOWNLOAD_METHOD_SETTING_KEY = "trading_bot_direct_download_method";
export const TRADING_BOT_LOCAL_DOWNLOAD_URL = "/api/download/trading-bot-app";
export const TRADING_BOT_APP_DOWNLOAD_FILENAME = "TradX-Bot.zip";

export const TRADING_BOT_DOWNLOAD_MODES = ["direct", "external"] as const;
export const TRADING_BOT_DIRECT_DOWNLOAD_METHODS = [
  "auto",
  "memory",
  "chrome-extension",
  "iframe",
  "fetch-blob",
  "stream",
] as const;

export type TradingBotDownloadMode = (typeof TRADING_BOT_DOWNLOAD_MODES)[number];
export type TradingBotDirectDownloadMethod = (typeof TRADING_BOT_DIRECT_DOWNLOAD_METHODS)[number];

export type TradingBotDownloadConfig = {
  mode: TradingBotDownloadMode;
  externalUrl: string;
  directMethod: TradingBotDirectDownloadMethod;
  url: string;
  fileName: string;
};

export const DEFAULT_TRADING_BOT_DOWNLOAD_MODE: TradingBotDownloadMode = "direct";
export const DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD: TradingBotDirectDownloadMethod = "auto";

export const TRADING_BOT_DIRECT_DOWNLOAD_METHOD_OPTIONS: Array<{
  value: TradingBotDirectDownloadMethod;
  label: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "Combined auto",
    description: "Try memory, stream, fetch/blob, then hidden link fallback.",
  },
  {
    value: "memory",
    label: "Memory download",
    description: "Fetch the EXE into memory, then save it through a hidden download link.",
  },
  {
    value: "chrome-extension",
    label: "Chrome extension",
    description: "Use an installed extension bridge when available, otherwise use the hidden link fallback.",
  },
  {
    value: "iframe",
    label: "Hidden iframe",
    description: "Start the EXE request in a temporary hidden iframe.",
  },
  {
    value: "fetch-blob",
    label: "Fetch + blob",
    description: "Fetch the EXE as a blob, then save it through an object URL.",
  },
  {
    value: "stream",
    label: "Stream download",
    description: "Read the EXE response stream, then save the completed blob.",
  },
];

export function normalizeTradingBotDownloadUrl(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isExternalTradingBotDownloadUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function isTradingBotDownloadMode(value: unknown): value is TradingBotDownloadMode {
  return typeof value === "string" && TRADING_BOT_DOWNLOAD_MODES.includes(value as TradingBotDownloadMode);
}

export function isTradingBotDirectDownloadMethod(value: unknown): value is TradingBotDirectDownloadMethod {
  return typeof value === "string" && TRADING_BOT_DIRECT_DOWNLOAD_METHODS.includes(value as TradingBotDirectDownloadMethod);
}

export function resolveTradingBotDirectDownloadMethod(value: unknown): TradingBotDirectDownloadMethod {
  return isTradingBotDirectDownloadMethod(value) ? value : DEFAULT_TRADING_BOT_DIRECT_DOWNLOAD_METHOD;
}

export function buildTradingBotDownloadConfig({
  mode,
  externalUrl,
  directMethod,
}: {
  mode?: unknown;
  externalUrl?: string | null;
  directMethod?: unknown;
}): TradingBotDownloadConfig {
  const normalizedExternalUrl = normalizeTradingBotDownloadUrl(externalUrl);
  const resolvedMode = isTradingBotDownloadMode(mode)
    ? mode
    : normalizedExternalUrl
      ? "external"
      : DEFAULT_TRADING_BOT_DOWNLOAD_MODE;
  const usableMode = resolvedMode === "external" && normalizedExternalUrl ? "external" : "direct";

  return {
    mode: usableMode,
    externalUrl: normalizedExternalUrl,
    directMethod: resolveTradingBotDirectDownloadMethod(directMethod),
    url: usableMode === "external" ? normalizedExternalUrl : TRADING_BOT_LOCAL_DOWNLOAD_URL,
    fileName: TRADING_BOT_APP_DOWNLOAD_FILENAME,
  };
}

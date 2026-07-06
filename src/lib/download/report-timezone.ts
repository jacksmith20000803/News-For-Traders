export const DOWNLOAD_REPORT_TIMEZONE_SETTING_KEY = "download_report_timezone";
export const FALLBACK_DOWNLOAD_REPORT_TIMEZONE = "America/Los_Angeles";

export const COMMON_DOWNLOAD_REPORT_TIMEZONES = [
  "UTC",
  "Asia/Tokyo",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
] as const;

export function normalizeDownloadReportTimezone(value: string | null | undefined) {
  return value?.trim() || FALLBACK_DOWNLOAD_REPORT_TIMEZONE;
}

export function isValidDownloadReportTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

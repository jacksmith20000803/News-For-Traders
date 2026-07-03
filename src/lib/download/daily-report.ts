import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const DOWNLOAD_REPORT_ACTIONS = [
  "trading_bot_app_downloaded",
  "trading_bot_app_installed",
] as const;

const REPORT_HOUR = 11;
const REPORT_DIRECTORY = path.join(process.cwd(), "storage", "download-reports");
const REPORT_TIMEZONE = process.env.DOWNLOAD_REPORT_TIMEZONE || "America/Los_Angeles";

type ReportWindow = {
  reportId: string;
  timezone: string;
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
};

type ReportRow = {
  name: string;
  country: string;
  time: string;
  action: "download" | "install";
  actorKey: string;
};

type ReportSummary = {
  reportId: string;
  timezone: string;
  windowStart: string;
  windowEnd: string;
  windowStartLabel: string;
  windowEndLabel: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  totalUsers: number;
  totalRecords: number;
  usersByCountry: Record<string, number>;
  recordsByAction: Record<"download" | "install", number>;
  generatedAt: string;
};

function getZonedParts(date: Date, timezone = REPORT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timezone = REPORT_TIMEZONE) {
  const parts = getZonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return zonedAsUtc - date.getTime();
}

function zonedTimeToUtc(
  dateParts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timezone = REPORT_TIMEZONE
) {
  const utcGuess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    dateParts.hour ?? 0,
    dateParts.minute ?? 0,
    dateParts.second ?? 0
  );
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timezone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timezone);
  return new Date(utcGuess - secondOffset);
}

function shiftCalendarDate(
  dateParts: { year: number; month: number; day: number },
  days: number
) {
  const shifted = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days, 12));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function reportIdFromLocalDate(dateParts: { year: number; month: number; day: number }) {
  return `${dateParts.year}-${String(dateParts.month).padStart(2, "0")}-${String(dateParts.day).padStart(2, "0")}`;
}

function formatInReportTimezone(date: Date, timezone = REPORT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(date);
}

function formatCountry(country: string | null | undefined) {
  const normalized = country?.trim();
  if (!normalized) return "Unknown";
  if (!/^[A-Za-z]{2}$/.test(normalized)) return normalized;

  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(normalized.toUpperCase()) || normalized.toUpperCase();
  } catch {
    return normalized.toUpperCase();
  }
}

function fileNameForReport(reportId: string) {
  return `trading-bot-download-report-${reportId}.txt`;
}

function filePathForReport(reportId: string) {
  return path.join(REPORT_DIRECTORY, fileNameForReport(reportId));
}

function windowFromEndLocalDate(dateParts: { year: number; month: number; day: number }): ReportWindow {
  const endParts = {
    year: dateParts.year,
    month: dateParts.month,
    day: dateParts.day,
  };
  const startParts = shiftCalendarDate(endParts, -1);
  const end = zonedTimeToUtc({ ...endParts, hour: REPORT_HOUR }, REPORT_TIMEZONE);
  const start = zonedTimeToUtc({ ...startParts, hour: REPORT_HOUR }, REPORT_TIMEZONE);
  return {
    reportId: reportIdFromLocalDate(dateParts),
    timezone: REPORT_TIMEZONE,
    start,
    end,
    startLabel: formatInReportTimezone(start),
    endLabel: formatInReportTimezone(end),
  };
}

export function getCompletedDownloadReportWindow(now = new Date()): ReportWindow {
  const today = getZonedParts(now, REPORT_TIMEZONE);
  const todayEnd = zonedTimeToUtc(
    { year: today.year, month: today.month, day: today.day, hour: REPORT_HOUR },
    REPORT_TIMEZONE
  );
  const endDateParts = now.getTime() >= todayEnd.getTime()
    ? today
    : shiftCalendarDate(today, -1);

  return windowFromEndLocalDate(endDateParts);
}

export function getNextDownloadReportBoundary(now = new Date()) {
  const today = getZonedParts(now, REPORT_TIMEZONE);
  const todayBoundary = zonedTimeToUtc(
    { year: today.year, month: today.month, day: today.day, hour: REPORT_HOUR },
    REPORT_TIMEZONE
  );
  if (now.getTime() < todayBoundary.getTime()) return todayBoundary;

  const tomorrow = shiftCalendarDate(today, 1);
  return zonedTimeToUtc({ ...tomorrow, hour: REPORT_HOUR }, REPORT_TIMEZONE);
}

export function getDownloadReportWindowForId(reportId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportId)) return null;
  const [year, month, day] = reportId.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return windowFromEndLocalDate({ year, month, day });
}

function eventActionLabel(action: string): "download" | "install" {
  return action === "trading_bot_app_installed" ? "install" : "download";
}

async function getReportRows(window: ReportWindow): Promise<ReportRow[]> {
  const rows = await db.visitorActivity.findMany({
    where: {
      action: { in: [...DOWNLOAD_REPORT_ACTIONS] },
      createdAt: { gte: window.start, lt: window.end },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          country: true,
        },
      },
    },
  });

  return rows.map((row) => {
    const userName = row.user?.name || row.user?.username || row.user?.email;
    const visitorName = row.visitorId ? `Visitor ${row.visitorId.slice(0, 8)}` : "Unknown user";
    const country = formatCountry(row.country || row.user?.country);

    return {
      name: userName || visitorName,
      country,
      time: formatInReportTimezone(row.createdAt, window.timezone),
      action: eventActionLabel(row.action),
      actorKey: row.userId ? `user:${row.userId}` : row.visitorId ? `visitor:${row.visitorId}` : `ip:${row.ipAddress ?? row.id}`,
    };
  });
}

function countUniqueActorsByCountry(rows: ReportRow[]) {
  const byCountry = new Map<string, Set<string>>();

  for (const row of rows) {
    const set = byCountry.get(row.country) ?? new Set<string>();
    set.add(row.actorKey);
    byCountry.set(row.country, set);
  }

  return Object.fromEntries(
    Array.from(byCountry.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, actors]) => [country, actors.size])
  );
}

function countRecordsByAction(rows: ReportRow[]) {
  return rows.reduce<Record<"download" | "install", number>>(
    (totals, row) => {
      totals[row.action] += 1;
      return totals;
    },
    { download: 0, install: 0 }
  );
}

function buildReportText(window: ReportWindow, rows: ReportRow[], generatedAt: Date) {
  const uniqueActors = new Set(rows.map((row) => row.actorKey));
  const usersByCountry = countUniqueActorsByCountry(rows);
  const recordsByAction = countRecordsByAction(rows);

  const lines = [
    "TRADX Daily Download / Install Report",
    `Report ID: ${window.reportId}`,
    `Window: ${window.startLabel} to ${window.endLabel}`,
    `Timezone: ${window.timezone}`,
    `Generated: ${formatInReportTimezone(generatedAt, window.timezone)}`,
    "",
    "Records",
    "Name | Country | Time | Action",
    "-----|---------|------|-------",
    ...(rows.length
      ? rows.map((row) => `${row.name} | ${row.country} | ${row.time} | ${row.action}`)
      : ["No download or install records in this window."]),
    "",
    "Totals",
    `Total users: ${uniqueActors.size}`,
    `Total records: ${rows.length}`,
    "",
    "Users by country",
    ...(Object.keys(usersByCountry).length
      ? Object.entries(usersByCountry).map(([country, count]) => `${country}: ${count}`)
      : ["None"]),
    "",
    "Records by action",
    `download: ${recordsByAction.download}`,
    `install: ${recordsByAction.install}`,
    "",
  ];

  return {
    text: lines.join("\n"),
    summary: {
      totalUsers: uniqueActors.size,
      totalRecords: rows.length,
      usersByCountry,
      recordsByAction,
    },
  };
}

export async function generateDownloadReport(window: ReportWindow) {
  const rows = await getReportRows(window);
  const generatedAt = new Date();
  const built = buildReportText(window, rows, generatedAt);
  const filePath = filePathForReport(window.reportId);
  const fileName = fileNameForReport(window.reportId);

  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(filePath, built.text, "utf8");

  const summary: ReportSummary = {
    reportId: window.reportId,
    timezone: window.timezone,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    windowStartLabel: window.startLabel,
    windowEndLabel: window.endLabel,
    fileName,
    filePath,
    downloadUrl: `/api/admin/download-reports/${window.reportId}`,
    totalUsers: built.summary.totalUsers,
    totalRecords: built.summary.totalRecords,
    usersByCountry: built.summary.usersByCountry,
    recordsByAction: built.summary.recordsByAction,
    generatedAt: generatedAt.toISOString(),
  };

  return summary;
}

export async function readOrGenerateDownloadReport(reportId: string) {
  const window = getDownloadReportWindowForId(reportId);
  if (!window) return null;

  const filePath = filePathForReport(reportId);
  try {
    await stat(filePath);
  } catch {
    await generateDownloadReport(window);
  }

  return {
    window,
    fileName: fileNameForReport(reportId),
    text: await readFile(filePath, "utf8"),
  };
}

async function notifyAdminsReportReady(report: ReportSummary) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", deletedAt: null, isBanned: false, isSuspended: false },
    select: { id: true },
  });
  if (!admins.length) return 0;

  const title = `Daily download report ready (${report.reportId})`;
  let created = 0;

  await Promise.all(
    admins.map(async (admin) => {
      const existing = await db.notification.findFirst({
        where: { userId: admin.id, title },
        select: { id: true },
      });
      if (existing) return;

      await createNotification({
        userId: admin.id,
        type: "SYSTEM",
        title,
        message: `The ${report.windowStartLabel} to ${report.windowEndLabel} download/install report is ready.`,
        metadata: {
          eventType: "download_report_ready",
          forceSystemNotification: true,
          reportId: report.reportId,
          downloadUrl: report.downloadUrl,
          windowStart: report.windowStart,
          windowEnd: report.windowEnd,
          totalUsers: report.totalUsers,
          totalRecords: report.totalRecords,
        },
      });
      created += 1;
    })
  );

  return created;
}

export async function ensureCompletedDownloadReport(now = new Date()) {
  const window = getCompletedDownloadReportWindow(now);
  const report = await generateDownloadReport(window);
  const notificationsCreated = await notifyAdminsReportReady(report);
  return {
    report,
    notificationsCreated,
    nextBoundaryAt: getNextDownloadReportBoundary(now).toISOString(),
  };
}

export async function listRecentDownloadReports(limit = 7) {
  const reports = [];
  let window = getCompletedDownloadReportWindow();

  for (let index = 0; index < limit; index += 1) {
    const filePath = filePathForReport(window.reportId);
    let fileStat: Awaited<ReturnType<typeof stat>> | null = null;
    try {
      fileStat = await stat(filePath);
    } catch {
      fileStat = null;
    }

    reports.push({
      reportId: window.reportId,
      timezone: window.timezone,
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      windowStartLabel: window.startLabel,
      windowEndLabel: window.endLabel,
      exists: Boolean(fileStat),
      generatedAt: fileStat?.mtime.toISOString() ?? null,
      downloadUrl: `/api/admin/download-reports/${window.reportId}`,
    });

    const previousEndParts = shiftCalendarDate(getZonedParts(window.end, window.timezone), -1);
    window = windowFromEndLocalDate(previousEndParts);
  }

  return reports;
}

import { ensureCompletedDownloadReport, getDownloadReportTimezone, getNextDownloadReportBoundary } from "@/lib/download/daily-report";

const MAX_TIMEOUT_MS = 2_147_483_647;
const FALLBACK_INTERVAL_MS = 60 * 1000;

type SchedulerState = {
  started: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
  interval: ReturnType<typeof setInterval> | null;
};

const globalForScheduler = globalThis as typeof globalThis & {
  __tradxDownloadReportScheduler?: SchedulerState;
};

function state() {
  if (!globalForScheduler.__tradxDownloadReportScheduler) {
    globalForScheduler.__tradxDownloadReportScheduler = {
      started: false,
      timeout: null,
      interval: null,
    };
  }

  return globalForScheduler.__tradxDownloadReportScheduler;
}

async function runDueReportCheck(source: string) {
  try {
    await ensureCompletedDownloadReport();
  } catch (error) {
    console.error(`[download-report-scheduler] ${source} check failed`, error);
  }
}

async function scheduleNextBoundary() {
  const scheduler = state();
  if (scheduler.timeout) clearTimeout(scheduler.timeout);

  const timezone = await getDownloadReportTimezone();
  const nextBoundary = getNextDownloadReportBoundary(new Date(), timezone);
  const delay = Math.max(1_000, Math.min(nextBoundary.getTime() - Date.now() + 500, MAX_TIMEOUT_MS));

  scheduler.timeout = setTimeout(() => {
    void runDueReportCheck("boundary").finally(() => {
      void scheduleNextBoundary();
    });
  }, delay);
}

export function startDownloadReportScheduler() {
  if (process.env.DISABLE_DOWNLOAD_REPORT_SCHEDULER === "1") return;

  const scheduler = state();
  if (scheduler.started) return;
  scheduler.started = true;

  scheduler.timeout = setTimeout(() => {
    void runDueReportCheck("startup").finally(() => {
      void scheduleNextBoundary();
    });
  }, 5_000);

  scheduler.interval = setInterval(() => {
    void runDueReportCheck("fallback").finally(() => {
      void scheduleNextBoundary();
    });
  }, FALLBACK_INTERVAL_MS);
}

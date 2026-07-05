export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDownloadReportScheduler } = await import("@/lib/download/report-scheduler");
  startDownloadReportScheduler();
}

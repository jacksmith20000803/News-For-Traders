"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/api/client";

type ReportItem = {
  reportId: string;
  windowStartLabel: string;
  windowEndLabel: string;
  exists: boolean;
  generatedAt: string | null;
  downloadUrl: string;
};

type ReportsResponse = {
  reports: ReportItem[];
  timezone: string;
  nextBoundaryAt: string;
};

type GenerateReportResponse = {
  report?: {
    warnings?: string[];
  };
};

export function AdminDownloadReportsPanel() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [nextBoundaryAt, setNextBoundaryAt] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const loadReports = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/download-reports?limit=7", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<{ success: boolean; data?: ReportsResponse; error?: string }>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Could not load reports");
      setReports(json.data.reports);
      setNextBoundaryAt(json.data.nextBoundaryAt);
      setTimezone(json.data.timezone);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  async function generateLatestReport() {
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/download-reports/due", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<{ success: boolean; data?: GenerateReportResponse; error?: string }>(response);
      if (!json.success) throw new Error(json.error ?? "Could not generate report");
      const warning = json.data?.report?.warnings?.[0];
      setMessage(warning ? `Latest completed report is ready with a warning: ${warning}` : "Latest completed report is ready.");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate report");
    } finally {
      setGenerating(false);
    }
  }

  const latest = reports[0];

  return (
    <section className="mb-6 rounded-3xl border border-border bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">Daily download/install reports</h2>
              <p className="text-sm text-muted-foreground">
                Report windows close daily at 11:00 AM{timezone ? ` (${timezone})` : ""}. Each text file lists name, country, time, action, and totals.
              </p>
            </div>
          </div>
          {nextBoundaryAt ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Next report closes at {new Date(nextBoundaryAt).toLocaleString(undefined, timezone ? { timeZone: timezone } : undefined)}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadReports()} disabled={loading || generating}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => void generateLatestReport()} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate latest
          </Button>
          {latest ? (
            <a
              href={latest.downloadUrl}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Download latest
            </a>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">Loading reports...</div>
        ) : reports.length ? (
          reports.map((report) => (
            <a
              key={report.reportId}
              href={report.downloadUrl}
              className="rounded-2xl border border-border bg-background/70 p-4 text-sm transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="font-semibold text-foreground">{report.reportId}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {report.windowStartLabel} to {report.windowEndLabel}
              </p>
              <p className="mt-3 text-xs font-semibold text-primary">
                {report.exists ? "Text file ready" : "Will generate on download"}
              </p>
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">No report windows found.</div>
        )}
      </div>
    </section>
  );
}

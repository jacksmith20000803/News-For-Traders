"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { COMMON_DOWNLOAD_REPORT_TIMEZONES } from "@/lib/download/report-timezone";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AdminDownloadReportSettingsForm({ initialTimezone }: { initialTimezone: string }) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveTimezone() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/admin/settings/download-report-timezone", {
        method: "POST",
        body: JSON.stringify({ timezone: timezone.trim() }),
      });
      const json = await readJsonResponse<ApiResponse<{ timezone?: string; message?: string }>>(response);
      if (!json.success) {
        throw new Error(json.error ?? "Could not update the report timezone.");
      }

      setTimezone(json.data?.timezone ?? timezone.trim());
      setMessage(json.data?.message ?? "Daily report timezone updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the report timezone.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Report Timezone</label>
        <Input
          list="download-report-timezones"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="Asia/Tokyo"
        />
        <datalist id="download-report-timezones">
          {COMMON_DOWNLOAD_REPORT_TIMEZONES.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Daily download/install report windows close at 11:00 AM in this timezone.
        </p>
      </div>

      {message ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <Button type="button" variant="success" isLoading={saving} onClick={saveTimezone}>
        Update Report Timezone
      </Button>
    </div>
  );
}

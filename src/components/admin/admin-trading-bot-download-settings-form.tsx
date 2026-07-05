"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AdminTradingBotDownloadSettingsForm({
  initialDownloadUrl,
  fallbackUrl,
}: {
  initialDownloadUrl: string;
  fallbackUrl: string;
}) {
  const [downloadUrl, setDownloadUrl] = useState(initialDownloadUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveDownloadUrl() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/admin/settings/trading-bot-download", {
        method: "POST",
        body: JSON.stringify({ downloadUrl: downloadUrl.trim() }),
      });
      const json = await readJsonResponse<ApiResponse<{ message?: string; downloadUrl?: string }>>(response);
      if (!json.success) {
        throw new Error(json.error ?? "Could not update the trading bot download link.");
      }

      setDownloadUrl(json.data?.downloadUrl ?? downloadUrl.trim());
      setMessage(json.data?.message ?? "Trading bot download link updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the trading bot download link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">External Download URL</label>
        <Input
          value={downloadUrl}
          onChange={(event) => setDownloadUrl(event.target.value)}
          placeholder="https://sendgb.com/..."
        />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Leave this empty to use the built-in fallback: {fallbackUrl}
        </p>
      </div>

      {message ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <Button type="button" variant="success" isLoading={saving} onClick={saveDownloadUrl}>
        Update Download Link
      </Button>
    </div>
  );
}

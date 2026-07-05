"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import {
  TRADING_BOT_DIRECT_DOWNLOAD_METHOD_OPTIONS,
  type TradingBotDirectDownloadMethod,
  type TradingBotDownloadConfig,
  type TradingBotDownloadMode,
} from "@/lib/download/trading-bot-links";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AdminTradingBotDownloadSettingsForm({
  initialConfig,
  fallbackUrl,
}: {
  initialConfig: TradingBotDownloadConfig;
  fallbackUrl: string;
}) {
  const [mode, setMode] = useState<TradingBotDownloadMode>(initialConfig.mode);
  const [externalUrl, setExternalUrl] = useState(initialConfig.externalUrl);
  const [directMethod, setDirectMethod] = useState<TradingBotDirectDownloadMethod>(initialConfig.directMethod);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedMethod = TRADING_BOT_DIRECT_DOWNLOAD_METHOD_OPTIONS.find((option) => option.value === directMethod);

  async function saveDownloadSettings() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/admin/settings/trading-bot-download", {
        method: "POST",
        body: JSON.stringify({
          mode,
          externalUrl: externalUrl.trim(),
          directMethod,
        }),
      });
      const json = await readJsonResponse<ApiResponse<{ message?: string; config?: TradingBotDownloadConfig }>>(response);
      if (!json.success) {
        throw new Error(json.error ?? "Could not update the trading bot download settings.");
      }

      if (json.data?.config) {
        setMode(json.data.config.mode);
        setExternalUrl(json.data.config.externalUrl);
        setDirectMethod(json.data.config.directMethod);
      }
      setMessage(json.data?.message ?? "Trading bot download settings updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the trading bot download settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium">Download Method</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["direct", "Direct EXE file"],
            ["external", "External transfer service"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value as TradingBotDownloadMode)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition",
                mode === value
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-border bg-background/70 text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">External File-Transfer URL</label>
        <Input
          value={externalUrl}
          onChange={(event) => setExternalUrl(event.target.value)}
          placeholder="https://sendgb.com/..."
        />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Required only when external transfer service is selected. Direct EXE mode uses {fallbackUrl}.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Direct EXE Silent Function</label>
        <select
          value={directMethod}
          onChange={(event) => setDirectMethod(event.target.value as TradingBotDirectDownloadMethod)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {TRADING_BOT_DIRECT_DOWNLOAD_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedMethod ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {selectedMethod.description}
          </p>
        ) : null}
      </div>

      {message ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <Button type="button" variant="success" isLoading={saving} onClick={saveDownloadSettings}>
        Update Download Settings
      </Button>
    </div>
  );
}

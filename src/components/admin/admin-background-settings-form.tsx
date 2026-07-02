"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AdminBackgroundSettingsForm({ initialImageUrl }: { initialImageUrl: string }) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [previewVisible, setPreviewVisible] = useState(Boolean(initialImageUrl));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveBackground() {
    setSaving(true);
    setMessage("Processing... Please wait a moment.");
    setError("");

    try {
      const response = await secureFetch("/api/admin/settings/background", {
        method: "POST",
        body: JSON.stringify({ imageUrl: imageUrl.trim() }),
      });
      const json = await readJsonResponse<ApiResponse<{ message?: string }>>(response);
      if (!json.success) {
        throw new Error(json.error ?? "Could not update background image.");
      }

      setPreviewVisible(Boolean(imageUrl.trim()));
      setMessage(json.data?.message ?? "Background image updated successfully.");
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Could not update background image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Background Image URL</label>
        <Input
          value={imageUrl}
          onChange={(event) => {
            setImageUrl(event.target.value);
            setPreviewVisible(Boolean(event.target.value.trim()));
          }}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      {previewVisible && imageUrl ? (
        <div>
          <label className="mb-2 block text-sm font-medium">Current Background</label>
          <div className="h-32 w-full overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={imageUrl}
              alt="Platform background"
              width={800}
              height={128}
              className="h-full w-full object-cover"
              onError={() => setPreviewVisible(false)}
            />
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <Button type="button" variant="success" isLoading={saving} onClick={saveBackground}>
        Update Background
      </Button>
    </div>
  );
}

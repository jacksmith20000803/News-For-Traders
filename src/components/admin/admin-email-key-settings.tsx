"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, RefreshCw, Save, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

type EmailKey = {
  id: string;
  displayName: string;
  apiKey: string;
  fromEmail: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const emptyForm = {
  id: "",
  displayName: "",
  apiKey: "",
  fromEmail: "",
  enabled: true,
};

export function AdminEmailKeySettings() {
  const [keys, setKeys] = useState<EmailKey[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/email-keys", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<{ keys: EmailKey[] }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Could not load email keys");
      setKeys(json.data.keys);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load email keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKeys();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveKey(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/email-keys", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      const json = await readJsonResponse<ApiResponse<{ key: EmailKey }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not save email key");
      setMessage(form.id ? "Email verification key updated." : "Email verification key added.");
      setForm(emptyForm);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save email key");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    if (!window.confirm("Remove this email verification API key?")) return;
    setSaving(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/email-keys", {
        method: "DELETE",
        body: JSON.stringify({ ids: [id] }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not delete email key");
      setMessage("Email verification key removed.");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete email key");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKey(key: EmailKey) {
    setSaving(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/email-keys", {
        method: "PATCH",
        body: JSON.stringify({
          id: key.id,
          displayName: key.displayName,
          fromEmail: key.fromEmail,
          enabled: !key.enabled,
        }),
      });
      const json = await readJsonResponse<ApiResponse<{ key: EmailKey }>>(response);
      if (!json.success) throw new Error(json.error ?? "Could not update email key");
      setMessage(!key.enabled ? "Email verification key enabled." : "Email verification key disabled.");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update email key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveKey} className="grid gap-3 rounded-2xl border border-border bg-background/80 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Display name"
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Primary Resend key"
          />
          <Input
            label="Resend API key"
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder={form.id ? "Leave blank to keep current key" : "re_..."}
          />
          <Input
            label="Sender email"
            value={form.fromEmail}
            onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))}
            placeholder="TRADX <verify@example.com>"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Active for verification email delivery
          </label>
          <div className="flex gap-2">
            {form.id ? (
              <Button type="button" variant="destructive" onClick={() => setForm(emptyForm)} disabled={saving}>
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            ) : null}
            <Button type="submit" variant="success" isLoading={saving}>
              <Save className="h-4 w-4" />
              {form.id ? "Save" : "Add key"}
            </Button>
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Active keys are tried before environment variables. Secret values stay server-side and are masked here.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadKeys()}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {message ? (
        <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3">
        {keys.map((key) => (
          <article key={key.id} className="rounded-2xl border border-border bg-background/85 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{key.displayName}</h3>
                  <Badge variant={key.enabled ? "success" : "outline"}>
                    {key.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{key.fromEmail}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{key.apiKey}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({
                      id: key.id,
                      displayName: key.displayName,
                      apiKey: "",
                      fromEmail: key.fromEmail,
                      enabled: key.enabled,
                    })
                  }
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant={key.enabled ? "outline" : "success"}
                  size="sm"
                  onClick={() => void toggleKey(key)}
                  disabled={saving}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {key.enabled ? "Disable" : "Enable"}
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => void deleteKey(key.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!keys.length && !loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No admin-managed verification email keys yet.
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

type PuterTokenRow = {
  id: string;
  displayName: string;
  maskedToken: string;
  selectedModels: string[];
  requestLimit: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  isActive: boolean;
  isExhausted: boolean;
  usageRate: number;
  lastUsedAt: string | null;
  lastError: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type TokenListData = {
  tokens: PuterTokenRow[];
  defaultModels?: string[];
  pagination: { page: number; totalPages: number };
};

const fallbackModels = ["gpt-5-nano", "gpt-5-mini", "gpt-4.1-mini", "claude-sonnet-4"];

export function PuterTokenManager() {
  const [tokens, setTokens] = useState<PuterTokenRow[]>([]);
  const [models, setModels] = useState(fallbackModels);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    token: "",
    selectedModels: ["gpt-5-nano"],
    requestLimit: 1000,
    isActive: true,
  });

  const selectedModelSet = useMemo(() => new Set(form.selectedModels), [form.selectedModels]);

  const loadTokens = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/puter-tokens?page=${nextPage}&limit=10`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<TokenListData>>(res);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load tokens");
      setTokens(json.data.tokens);
      setModels(json.data.defaultModels?.length ? json.data.defaultModels : fallbackModels);
      setPage(json.data.pagination.page);
      setTotalPages(json.data.pagination.totalPages);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTokens(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTokens]);

  function resetForm() {
    setEditingId(null);
    setForm({
      displayName: "",
      token: "",
      selectedModels: ["gpt-5-nano"],
      requestLimit: 1000,
      isActive: true,
    });
  }

  function editToken(token: PuterTokenRow) {
    setEditingId(token.id);
    setForm({
      displayName: token.displayName,
      token: "",
      selectedModels: token.selectedModels.length ? token.selectedModels : ["gpt-5-nano"],
      requestLimit: token.requestLimit,
      isActive: token.isActive,
    });
  }

  function toggleModel(model: string) {
    setForm((prev) => {
      const next = new Set(prev.selectedModels);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return { ...prev, selectedModels: next.size ? Array.from(next) : [model] };
    });
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const trimmedToken = form.token.trim();
      const payload = {
        displayName: form.displayName.trim(),
        selectedModels: form.selectedModels,
        requestLimit: form.requestLimit,
        isActive: form.isActive,
        ...(editingId ? { id: editingId } : {}),
        ...(!editingId || trimmedToken ? { token: trimmedToken } : {}),
      };
      const res = await secureFetch("/api/admin/puter-tokens", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<ApiResponse<unknown>>(res);
      if (!json.success) throw new Error(json.error ?? "Token save failed");
      setMessage(editingId ? "Token updated" : "Token added");
      resetForm();
      await loadTokens(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Token save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteToken(id: string) {
    if (!confirm("Delete this AI token?")) return;
    setMessage("");
    try {
      const res = await secureFetch("/api/admin/puter-tokens", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      const json = await readJsonResponse<ApiResponse<unknown>>(res);
      if (!json.success) throw new Error(json.error ?? "Delete failed");
      setMessage("Token deleted");
      await loadTokens(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <form onSubmit={submitForm} className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-emerald-400" />
          <h2 className="font-semibold">{editingId ? "Edit AI Token" : "Add AI Token"}</h2>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Display name</span>
            <input
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              AI token {editingId ? "(leave blank to keep current)" : ""}
            </span>
            <input
              value={form.token}
              onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
              required={!editingId}
              type="password"
            />
          </label>
          <div className="text-sm">
            <span className="mb-2 block text-muted-foreground">Selected models</span>
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleModel(model)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selectedModelSet.has(model)
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" variant="success" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="destructive" type="button" onClick={resetForm} disabled={saving}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Stored Tokens</h2>
          <Button size="sm" variant="outline" onClick={() => loadTokens(page)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Token</th>
                <th className="pb-3 pr-4">Usage</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Models</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b border-border/50 align-top">
                  <td className="py-3 pr-4 font-medium">{token.displayName}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {token.maskedToken}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="min-w-32">
                      <div className="mb-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${token.usageRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {token.requestCount}/{token.requestLimit} ({token.successCount} ok,{" "}
                        {token.failureCount} fail)
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <Badge variant={token.isActive ? "success" : "default"}>
                        {token.isActive ? "Active" : "Paused"}
                      </Badge>
                      {token.isExhausted && <Badge variant="warning">Exhausted</Badge>}
                      {token.lastError && (
                        <p className="max-w-48 text-xs text-danger">{token.lastError}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex max-w-60 flex-wrap gap-1">
                      {token.selectedModels.map((model) => (
                        <Badge key={model} variant="outline">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => editToken(token)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteToken(token.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!tokens.length && !loading && (
                <tr>
                  <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                    No AI tokens stored yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => loadTokens(page - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => loadTokens(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

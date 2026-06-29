"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/api/client";

const TYPES = [
  { value: "CONTACT", label: "Contact" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "BUG", label: "Bug Report" },
  { value: "SUGGESTION", label: "Suggestion" },
] as const;

export function FeedbackForm() {
  const [form, setForm] = useState({
    type: "CONTACT" as (typeof TYPES)[number]["value"],
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await readJsonResponse<{ success: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        setError(json.error ?? "Feedback could not be sent.");
        return;
      }

      setSent(true);
      setForm({ type: "CONTACT", name: "", email: "", subject: "", message: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Feedback could not be sent.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="dash-panel rounded-2xl p-6 text-center">
        <p className="text-emerald-400 font-medium">Thank you — we received your message.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="dash-panel space-y-4 rounded-2xl p-6">
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
          className="btn-3d rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm appearance-none cursor-pointer"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          required
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm"
        />
      </div>
      <input
        required
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="Subject"
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
        className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm"
      />
      <textarea
        required
        rows={4}
        placeholder="Message"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm resize-none"
      />
      <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500">
        {loading ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}

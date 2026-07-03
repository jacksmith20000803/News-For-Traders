"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { INTEREST_LABELS } from "@/lib/constants";
import type { InterestCategory } from "@prisma/client";

const MARKETS = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "FOREX", label: "Forex" },
  { value: "STOCKS", label: "Stocks" },
  { value: "COMMODITIES", label: "Commodities" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [market, setMarket] = useState<(typeof MARKETS)[number]["value"]>("STOCKS");
  const [categories, setCategories] = useState<InterestCategory[]>([]);
  const [notif, setNotif] = useState({ email: true, push: true, priceAlerts: true, newsAlerts: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleCat = (cat: InterestCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const completeOnboarding = async (selectedCategories: InterestCategory[]) => {
    setLoading(true);
    setError("");

    try {
      const response = await secureFetch("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          preferredMarket: market,
          categories: selectedCategories,
          emailEnabled: notif.email,
          pushEnabled: notif.push,
          priceAlerts: notif.priceAlerts,
          newsAlerts: notif.newsAlerts,
        }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!json.success) throw new Error(json.error ?? "Could not complete onboarding.");
      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not complete onboarding.");
      setLoading(false);
    }
  };

  const finish = async () => {
    await completeOnboarding(categories);
  };

  const skip = async () => {
    await completeOnboarding([]);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold gradient-text">Welcome to TRADX</h1>
        <p className="text-sm text-muted-foreground mt-2">Step {step} of 3 — personalize your terminal</p>
        <button
          type="button"
          onClick={skip}
          disabled={loading}
          className="mt-3 rounded-full border border-border bg-card/90 px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-emerald-400/50 hover:text-emerald-500 active:scale-95 disabled:opacity-60"
        >
          {loading ? "Please wait..." : "Skip for now"}
        </button>
        {error ? (
          <p role="alert" className="mx-auto mt-3 max-w-sm rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {step === 1 && (
        <div className="dash-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold">Preferred market</h2>
          <div className="grid grid-cols-2 gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMarket(m.value)}
                className={`rounded-xl px-4 py-3 text-sm font-medium border transition-colors ${
                  market === m.value
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-white/8 hover:bg-white/5"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(2)}>Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="dash-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold">Your interests</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(INTEREST_LABELS) as [InterestCategory, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleCat(key)}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  categories.includes(key)
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-white/8"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" disabled={categories.length === 0} onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="dash-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold">Notification preferences</h2>
          {[
            { key: "email" as const, label: "Email notifications" },
            { key: "push" as const, label: "Browser push notifications" },
            { key: "priceAlerts" as const, label: "Price alerts" },
            { key: "newsAlerts" as const, label: "Breaking news" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between text-sm">
              {label}
              <input
                type="checkbox"
                checked={notif[key]}
                onChange={(e) => setNotif({ ...notif, [key]: e.target.checked })}
                className="accent-emerald-500"
              />
            </label>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button className="flex-1 bg-emerald-600" disabled={loading} onClick={finish}>
              {loading ? "Setting up…" : "Launch Terminal"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { secureFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { AlertType, AlertChannel } from "@prisma/client";

interface PriceAlert {
  id: string;
  symbol: string;
  assetType: string;
  alertType: AlertType;
  threshold: number | null;
  keyword: string | null;
  channels: AlertChannel;
  isActive: boolean;
  triggeredAt: string | null;
}

interface AlertRule {
  id: string;
  name: string;
  symbol: string | null;
  alertType: AlertType;
  threshold: number | null;
  keyword: string | null;
  channels: AlertChannel;
  isActive: boolean;
}

const ALERT_LABELS: Record<AlertType, string> = {
  PRICE_CROSS_ABOVE: "Price crosses above",
  PRICE_CROSS_BELOW: "Price crosses below",
  PERCENT_CHANGE: "% change",
  VOLATILITY_SPIKE: "Volatility spike",
  NEWS_MENTION: "News mention",
};

export function AlertsManager() {
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    symbol: "",
    alertType: "PRICE_CROSS_ABOVE" as AlertType,
    threshold: "",
    channels: "BOTH" as AlertChannel,
  });
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/alerts");
    const json = await res.json();
    if (json.success && mountedRef.current) {
      setPriceAlerts(json.data.priceAlerts);
      setRules(json.data.rules);
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => load(), 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [load]);

  const createAlert = async () => {
    await secureFetch("/api/alerts", {
      method: "POST",
      body: JSON.stringify({
        symbol: form.symbol.toUpperCase(),
        assetType: "stock",
        alertType: form.alertType,
        threshold: form.threshold ? parseFloat(form.threshold) : undefined,
        channels: form.channels,
      }),
    });
    setForm({ symbol: "", alertType: "PRICE_CROSS_ABOVE", threshold: "", channels: "BOTH" });
    setShowForm(false);
    load();
  };

  const toggleActive = async (id: string, kind: "price" | "rule", isActive: boolean) => {
    await secureFetch("/api/alerts", {
      method: "PATCH",
      body: JSON.stringify({ id, kind, isActive: !isActive }),
    });
    load();
  };

  const deleteAlert = async (id: string, kind: "price" | "rule") => {
    await secureFetch(`/api/alerts?id=${id}&kind=${kind}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="skeleton h-48 rounded-2xl" />;

  const allAlerts = [
    ...priceAlerts.map((a) => ({ ...a, kind: "price" as const, name: a.symbol })),
    ...rules.map((r) => ({ ...r, kind: "rule" as const })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Bell className="h-3.5 w-3.5 mr-1" />
          New Alert
        </Button>
      </div>

      {showForm && (
        <div className="dash-panel rounded-2xl p-4 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Symbol (e.g. AAPL, BTC)"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm font-mono"
          />
          <select
            value={form.alertType}
            onChange={(e) => setForm({ ...form, alertType: e.target.value as AlertType })}
            className="btn-3d rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm appearance-none cursor-pointer"
          >
            {Object.entries(ALERT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            placeholder="Threshold (price or %)"
            type="number"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm"
          />
          <select
            value={form.channels}
            onChange={(e) => setForm({ ...form, channels: e.target.value as AlertChannel })}
            className="btn-3d rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm appearance-none cursor-pointer"
          >
            <option value="IN_APP">In-app only</option>
            <option value="EMAIL">Email only</option>
            <option value="BOTH">In-app + Email</option>
          </select>
          <Button className="sm:col-span-2" onClick={createAlert} disabled={!form.symbol.trim()}>
            Create Alert
          </Button>
        </div>
      )}

      {allAlerts.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No alerts configured</p>
      ) : (
        <div className="space-y-2">
          {allAlerts.map((alert) => (
            <div
              key={`${alert.kind}-${alert.id}`}
              className="dash-panel flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <Bell className={cn("h-4 w-4 shrink-0", alert.isActive ? "text-cyan-400" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium">{alert.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ALERT_LABELS[alert.alertType]}
                  {alert.threshold != null && ` · ${alert.threshold}`}
                  {" · "}
                  {alert.channels === "BOTH" ? "In-app + Email" : alert.channels === "EMAIL" ? "Email" : "In-app"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(alert.id, alert.kind, alert.isActive)}
                className="text-muted-foreground hover:text-foreground"
                title={alert.isActive ? "Disable" : "Enable"}
              >
                {alert.isActive ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => deleteAlert(alert.id, alert.kind)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

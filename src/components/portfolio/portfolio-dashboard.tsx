"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { secureFetch } from "@/lib/api/client";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import Link from "next/link";

interface Position {
  id: string;
  symbol: string;
  assetType: string;
  category: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: Position[];
  allocation: Array<{ symbol: string; weight: number; category: string; marketValue: number }>;
}

export function PortfolioDashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: "", quantity: "", entryPrice: "" });
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/portfolio");
    const json = await res.json();
    if (json.success && mountedRef.current) {
      setSummary(json.data);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => load(), 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [load]);

  const addPosition = async () => {
    await secureFetch("/api/portfolio", {
      method: "POST",
      body: JSON.stringify({
        symbol: form.symbol.toUpperCase(),
        assetType: "stock",
        category: "STOCKS",
        quantity: parseFloat(form.quantity),
        entryPrice: parseFloat(form.entryPrice),
      }),
    });
    setForm({ symbol: "", quantity: "", entryPrice: "" });
    setShowForm(false);
    load();
  };

  const removePosition = async (id: string) => {
    await secureFetch(`/api/portfolio?positionId=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  if (!summary) return null;

  const positive = summary.totalPnl >= 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="dash-panel rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Value</p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            ${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="dash-panel rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
          <p className={cn("text-2xl font-bold font-mono tabular-nums flex items-center gap-1", positive ? "text-accent" : "text-destructive")}>
            {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            ${Math.abs(summary.totalPnl).toFixed(2)}
          </p>
        </div>
        <div className="dash-panel rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Return</p>
          <p className={cn("text-2xl font-bold font-mono tabular-nums", positive ? "text-accent" : "text-destructive")}>
            {positive ? "+" : ""}{summary.totalPnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Positions */}
        <div className="dash-panel rounded-2xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Positions</h2>
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          {showForm && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <input
                placeholder="Symbol"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5 text-xs font-mono"
              />
              <input
                placeholder="Qty"
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5 text-xs"
              />
              <input
                placeholder="Entry $"
                type="number"
                value={form.entryPrice}
                onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5 text-xs"
              />
              <Button size="sm" className="col-span-3" onClick={addPosition}>Save Position</Button>
            </div>
          )}

          {summary.positions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No positions — add your first trade</p>
          ) : (
            <div className="space-y-2">
              {summary.positions.map((p) => {
                const slug = p.symbol.replace(/[\/=]/g, "").toUpperCase();
                const pos = p.pnl >= 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                    <Link href={`/assets/${slug}`} className="font-mono text-sm font-medium text-cyan-400 min-w-[60px]">
                      {p.symbol}
                    </Link>
                    <span className="text-xs text-muted-foreground">{p.quantity} @ ${p.entryPrice.toFixed(2)}</span>
                    <span className="ml-auto font-mono text-xs tabular-nums">${p.marketValue.toFixed(2)}</span>
                    <span className={cn("font-mono text-xs tabular-nums w-16 text-right", pos ? "text-accent" : "text-destructive")}>
                      {pos ? "+" : ""}{p.pnlPercent.toFixed(1)}%
                    </span>
                    <button type="button" onClick={() => removePosition(p.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Allocation */}
        <div className="dash-panel rounded-2xl p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Allocation</h2>
          <AllocationChart slices={summary.allocation} />
        </div>
      </div>
    </div>
  );
}

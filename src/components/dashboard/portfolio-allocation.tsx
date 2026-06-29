"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Allocation {
  name: string;
  value: number;
  color: string;
}

interface ApiAllocation {
  category?: string;
  name?: string;
  percentage?: number;
  value?: number;
}

const colorMap: Record<string, string> = {
  Technology: "#22c55e",
  Finance: "#10b981",
  Healthcare: "#8b5cf6",
  Energy: "#f59e0b",
  Cash: "#fbbf24",
  Crypto: "#3b82f6",
  RealEstate: "#ec4899",
  Other: "#06b6d4",
};

export function PortfolioAllocation() {
  const [allocations, setAllocations] = useState<Allocation[]>([
    { name: "Technology", value: 45, color: colorMap.Technology },
    { name: "Finance", value: 25, color: colorMap.Finance },
    { name: "Healthcare", value: 15, color: colorMap.Healthcare },
    { name: "Energy", value: 10, color: colorMap.Energy },
    { name: "Cash", value: 5, color: colorMap.Cash },
  ]);
  const [loading, setLoading] = useState(true);
  const totalAllocation = allocations.reduce((sum, alloc) => sum + Math.max(alloc.value, 0), 0) || 1;

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        const res = await fetch("/api/portfolio");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.allocation) {
            const realAllocations = json.data.allocation.map((alloc: ApiAllocation) => ({
              name: alloc.category || alloc.name || "Other",
              value: alloc.percentage || alloc.value || 0,
              color: colorMap[alloc.category || ""] || colorMap[alloc.name || ""] || "#06b6d4",
            }));
            if (realAllocations.length > 0) {
              setAllocations(realAllocations);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch portfolio allocation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, []);

  return (
    <div className="dash-panel flex h-full min-h-[330px] flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Portfolio Allocation</h3>
        <Link href="/dashboard/portfolio" className="text-xs font-bold text-primary hover:underline">
          View Report
        </Link>
      </div>
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[minmax(220px,0.9fr)_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[17rem] shrink-0 sm:max-w-[19rem] lg:max-w-[20rem]">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {allocations.map((alloc, index) => {
              const offset = allocations.slice(0, index).reduce((sum, a) => sum + a.value, 0);
              const circumference = 2 * Math.PI * 40;
              const normalizedValue = (alloc.value / totalAllocation) * 100;
              const normalizedOffset = (offset / totalAllocation) * 100;
              const strokeDasharray = `${(normalizedValue / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((normalizedOffset / 100) * circumference);

              return (
                <circle
                  key={alloc.name}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={alloc.color}
                  strokeWidth="15"
                  strokeLinecap="butt"
                  style={{
                    strokeDasharray,
                    strokeDashoffset,
                  }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-[18%] rounded-full bg-background/85 shadow-inner ring-1 ring-border/60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold text-muted-foreground">Total</span>
            <span className="font-mono text-lg font-extrabold tracking-tight sm:text-xl">$126,430</span>
          </div>
        </div>

        <div className="grid gap-3">
          {loading ? (
            <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            allocations.map((alloc) => (
              <div
                key={alloc.name}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/55 p-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: alloc.color }} />
                  <span className="text-sm font-bold">{alloc.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-extrabold">{alloc.value.toFixed(1)}%</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    ${((alloc.value / 100) * 126430).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

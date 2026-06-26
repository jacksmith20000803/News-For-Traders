"use client";

import { PieChart } from "lucide-react";
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
  Technology: "#3b82f6",
  Finance: "#10b981",
  Healthcare: "#8b5cf6",
  Energy: "#eab308",
  Cash: "#6b7280",
  Crypto: "#f97316",
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
              color: colorMap[alloc.category || ""] || colorMap[alloc.name || ""] || "bg-cyan-500",
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
    <div className="dash-panel p-4 sm:p-5">
      <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 sm:mb-4 uppercase tracking-wider">
        Portfolio Allocation
      </h3>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0">
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
                  strokeWidth="13"
                  strokeLinecap="butt"
                  style={{
                    strokeDasharray,
                    strokeDashoffset,
                  }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <PieChart className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 sm:space-y-2">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : (
            allocations.map((alloc) => (
              <div key={alloc.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded" style={{ backgroundColor: alloc.color }} />
                  <span className="text-xs sm:text-sm">{alloc.name}</span>
                </div>
                <span className="text-xs sm:text-sm font-mono font-bold">{alloc.value.toFixed(1)}%</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

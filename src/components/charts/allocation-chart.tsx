"use client";

interface AllocationSlice {
  symbol: string;
  weight: number;
  category: string;
}

const COLORS = ["#22d3ee", "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

export function AllocationChart({ slices }: { slices: AllocationSlice[] }) {
  if (slices.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No positions yet</p>;
  }

  let cumulative = 0;
  const gradientStops = slices.map((s, i) => {
    const start = cumulative;
    cumulative += s.weight;
    return `${COLORS[i % COLORS.length]} ${start}% ${cumulative}%`;
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradientStops.join(", ")})` }}
      />
      <div className="space-y-2 flex-1 w-full">
        {slices.map((s, i) => (
          <div key={`alloc-${s.symbol}`} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="font-mono font-medium">{s.symbol}</span>
            </div>
            <span className="text-muted-foreground tabular-nums">{s.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

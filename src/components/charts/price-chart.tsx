"use client";

interface PriceChartProps {
  data: Array<{ price: number; timestamp: string }>;
  width?: number;
  height?: number;
}

export function PriceChart({ data, width = 600, height = 200 }: PriceChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/6 bg-white/[0.02] text-sm text-muted-foreground"
        style={{ width, height }}
      >
        Insufficient price history — run market ingestion
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = 8;

  const points = prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (p - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const positive = prices[prices.length - 1] >= prices[0];
  const stroke = positive ? "#34d399" : "#f87171";
  const fill = positive ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)";

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="rounded-xl overflow-hidden">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill="url(#chartFill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

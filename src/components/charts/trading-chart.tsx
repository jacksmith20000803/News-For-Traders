"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  AreaSeries,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
} from "lightweight-charts";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { subscribeRealtimeSync } from "@/components/realtime/realtime-sync";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { secureFetch } from "@/lib/api/client";

const INTERVALS = ["1s", "1m", "5m", "15m", "1H", "4H", "1D", "1W", "1Y"] as const;
const INDICATORS = ["SMA", "EMA", "RSI", "MACD"] as const;

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

const INTERVAL_SECONDS: Record<(typeof INTERVALS)[number], number> = {
  "1s": 1,
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "1W": 604800,
  "1Y": 31536000,
};

function toUnixTime(time: unknown): number | null {
  if (typeof time === "number" && Number.isFinite(time)) return Math.floor(time);
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  if (time && typeof time === "object") {
    const maybeDay = time as { year?: unknown; month?: unknown; day?: unknown };
    if (
      typeof maybeDay.year === "number" &&
      typeof maybeDay.month === "number" &&
      typeof maybeDay.day === "number"
    ) {
      return Math.floor(Date.UTC(maybeDay.year, maybeDay.month - 1, maybeDay.day) / 1000);
    }
  }
  return null;
}

function normalizeMarketSymbol(value: string) {
  return value.toUpperCase().replace(/\/USD$/, "");
}

function isSameMarketSymbol(a: string, b: string) {
  return normalizeMarketSymbol(a) === normalizeMarketSymbol(b);
}

function normalizeCandles(candles: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();

  for (const candle of candles) {
    const time = toUnixTime(candle.time);
    if (time === null) continue;
    byTime.set(time, { ...candle, time: time as Time });
  }

  return Array.from(byTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, candle]) => candle);
}

interface TradingChartProps {
  initialSymbol?: string;
  initialAssetType?: string;
  favorites?: string[];
  variant?: "terminal" | "dashboard";
}

export function TradingChart({
  initialSymbol = "BTC/USD",
  initialAssetType = "crypto",
  favorites = [],
  variant = "terminal",
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const candleDataRef = useRef<Candle[]>([]);
  const latestCandleRef = useRef<Candle | null>(null);
  const pollInFlightRef = useRef(false);
  const olderFetchInFlightRef = useRef(false);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [assetType, setAssetType] = useState(initialAssetType);
  const [chartInterval, setChartInterval] = useState<(typeof INTERVALS)[number]>("1s");
  const [indicators, setIndicators] = useState<Set<(typeof INDICATORS)[number]>>(new Set(["SMA"]));
  const [price, setPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [high24h, setHigh24h] = useState<number>(0);
  const [low24h, setLow24h] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<Set<string>>(new Set(favorites));
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | null>(null);
  const priceRef = useRef<number | null>(null);

  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  const updateLiveCandle = useCallback((newPrice: number, timestamp?: string | number) => {
    const candleSeries = candleRef.current;
    const areaSeries = areaRef.current;
    const sourceTime = toUnixTime(timestamp) ?? Math.floor(Date.now() / 1000);
    const intervalSeconds = INTERVAL_SECONDS[chartInterval];
    const bucketTime = Math.floor(sourceTime / intervalSeconds) * intervalSeconds;
    const latest = latestCandleRef.current;
    if (!candleSeries && !areaSeries) return;

    if (!latest) {
      const firstCandle: Candle = {
        time: bucketTime as Time,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
      };
      candleSeries?.update(firstCandle);
      areaSeries?.update({ time: firstCandle.time, value: firstCandle.close });
      candleDataRef.current = [firstCandle];
      latestCandleRef.current = firstCandle;
      return;
    }

    const latestTime = toUnixTime(latest.time);
    if (latestTime === null) return;

    const nextTime = Math.max(bucketTime, latestTime);

    const nextCandle: Candle =
      nextTime > latestTime
        ? {
            time: nextTime as Time,
            open: latest.close,
            high: Math.max(latest.close, newPrice),
            low: Math.min(latest.close, newPrice),
            close: newPrice,
          }
        : {
            ...latest,
            high: Math.max(latest.high, newPrice),
            low: Math.min(latest.low, newPrice),
            close: newPrice,
          };

    candleSeries?.update(nextCandle);
    areaSeries?.update({ time: nextCandle.time, value: nextCandle.close });
    candleDataRef.current =
      nextTime > latestTime
        ? [...candleDataRef.current, nextCandle]
        : candleDataRef.current.map((candle) =>
            toUnixTime(candle.time) === latestTime ? nextCandle : candle
          );
    latestCandleRef.current = nextCandle;
  }, [chartInterval]);

  const fetchOlderCandles = useCallback(async () => {
    if (
      olderFetchInFlightRef.current ||
      chartInterval === "1D" ||
      chartInterval === "1W" ||
      chartInterval === "1Y"
    ) return;

    const firstCandle = candleDataRef.current[0];
    const firstTime = firstCandle ? toUnixTime(firstCandle.time) : null;
    if (!firstTime) return;

    olderFetchInFlightRef.current = true;
    try {
      const response = await fetch(
        `/api/market/candles?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}&interval=${chartInterval}&before=${firstTime}&limit=240`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !Array.isArray(json.data?.candles)) return;

      const olderCandles = normalizeCandles(
        json.data.candles.map(
          (c: { time: number; open: number; high: number; low: number; close: number }) => ({
            ...c,
            time: c.time as Time,
          })
        )
      ).filter((candle) => {
        const time = toUnixTime(candle.time);
        return time !== null && time < firstTime;
      });

      if (olderCandles.length === 0) return;

      const merged = normalizeCandles([...olderCandles, ...candleDataRef.current]);
      candleDataRef.current = merged;
      candleRef.current?.setData(merged);
      areaRef.current?.setData(merged.map((candle) => ({ time: candle.time, value: candle.close })));
      latestCandleRef.current = merged[merged.length - 1] ?? latestCandleRef.current;
    } finally {
      olderFetchInFlightRef.current = false;
    }
  }, [assetType, chartInterval, symbol]);

  const loadChart = useCallback(async () => {
    setLoading(true);
    
    // Use historical data API for longer time ranges (1D, 1W, 1Y)
    // Fetch full historical data from past to current time
    const useHistorical = chartInterval === "1D" || chartInterval === "1W" || chartInterval === "1Y";
    const historicalDays =
      chartInterval === "1D" ? 365 : chartInterval === "1W" ? 730 : 3650;

    const responses = await Promise.all([
      useHistorical
        ? fetch(
            `/api/market/historical?symbol=${encodeURIComponent(symbol.replace("/USD", ""))}&days=${historicalDays}`,
            { cache: "no-store" }
          )
        : fetch(
            `/api/market/candles?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}&interval=${chartInterval}`,
            { cache: "no-store" }
          ),
      fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
    ]).catch(() => null);

    if (!responses) {
      setLoading(false);
      return;
    }

    const [candlesRes, quoteRes] = responses;

    // Check if responses are OK before parsing JSON
    if (!candlesRes.ok || !quoteRes.ok) {
      setLoading(false);
      return;
    }

    const candlesJson = await candlesRes.json().catch(() => null);
    const quoteJson = await quoteRes.json().catch(() => null);

    if (!candlesJson || !quoteJson) {
      setLoading(false);
      return;
    }

    let candles: Candle[];
    
    if (useHistorical && candlesJson.success && candlesJson.data?.data) {
      // Transform historical data to candle format
      candles = candlesJson.data.data.map((d: { timestamp: number; price: number; open?: number | null; high?: number | null; low?: number | null; close?: number | null }) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        open: d.open ?? d.price,
        high: d.high ?? d.price,
        low: d.low ?? d.price,
        close: d.close ?? d.price,
      }));
    } else {
      candles = (candlesJson.success ? candlesJson.data.candles : []).map(
        (c: { time: number; open: number; high: number; low: number; close: number }) => ({
          ...c,
          time: c.time as Time,
        })
      );
    }

    candles = normalizeCandles(candles);

    if (quoteJson.success && quoteJson.data?.quote) {
      const quote = quoteJson.data.quote;
      setPrice(quote.price);
      setPriceChange(quote.changePercent || 0);
      setVolume(quote.volume || 0);
      setHigh24h(quote.high24h || 0);
      setLow24h(quote.low24h || 0);
    }

    if (!containerRef.current) return;

    try {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleRef.current = null;
      areaRef.current = null;
    } catch {
      // Ignore errors during chart removal
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#e8e8e8",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.08)" },
        horzLines: { color: "rgba(255,255,255,0.08)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(0, 212, 170, 0.5)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(0, 212, 170, 0.5)",
          width: 1,
          style: 2,
        },
      },
      width: containerRef.current.clientWidth,
      height: variant === "dashboard" ? 420 : 500,
    });

    if (variant === "dashboard") {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#00d4aa",
        downColor: "#ff4757",
        borderVisible: true,
        borderUpColor: "#00d4aa",
        borderDownColor: "#ff4757",
        wickUpColor: "#00d4aa",
        wickDownColor: "#ff4757",
      });

      candleSeries.setData(candles);
      candleRef.current = candleSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: "#00a48d",
        topColor: "rgba(0, 164, 141, 0.24)",
        bottomColor: "rgba(0, 164, 141, 0.03)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });

      areaSeries.setData(candles.map((candle) => ({ time: candle.time, value: candle.close })));
      areaRef.current = areaSeries;
    }

    candleDataRef.current = candles;
    latestCandleRef.current = candles[candles.length - 1] ?? null;

    const closes = candles.map((c) => c.close);

    if (variant === "dashboard" && indicators.has("SMA")) {
      const sma = computeSMA(closes, 20);
      const smaSeries = chart.addSeries(LineSeries, { color: "#fbbf24", lineWidth: 2, title: "SMA 20" });
      smaSeries.setData(
        candles
          .map((c, i) => (sma[i] != null ? { time: c.time, value: sma[i]! } : null))
          .filter(Boolean) as { time: Time; value: number }[]
      );
    }

    if (variant === "dashboard" && indicators.has("EMA")) {
      const ema = computeEMA(closes, 12);
      const emaSeries = chart.addSeries(LineSeries, { color: "#00d4ff", lineWidth: 2, title: "EMA 12" });
      emaSeries.setData(
        candles
          .map((c, i) => (ema[i] != null ? { time: c.time, value: ema[i]! } : null))
          .filter(Boolean) as { time: Time; value: number }[]
      );
    }

    if (variant === "dashboard" && indicators.has("RSI")) {
      const rsi = computeRSI(closes);
      const rsiPane = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 2, title: "RSI" });
      rsiPane.setData(
        candles
          .map((c, i) => (rsi[i] != null ? { time: c.time, value: rsi[i]! } : null))
          .filter(Boolean) as { time: Time; value: number }[]
      );
    }

    if (variant === "dashboard" && indicators.has("MACD")) {
      const { macd } = computeMACD(closes);
      const macdSeries = chart.addSeries(HistogramSeries, { color: "#00ff88" });
      macdSeries.setData(
        candles
          .map((c, i) =>
            macd[i] != null
              ? { time: c.time, value: macd[i]!, color: macd[i]! >= 0 ? "#00ff88" : "#ff4757" }
              : null
          )
          .filter(Boolean) as { time: Time; value: number; color: string }[]
      );
    }

    chart.timeScale().fitContent();
    chart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (!range || range.from > 18) return;
      void fetchOlderCandles();
    });
    chartRef.current = chart;

    if (candles.length > 0) {
      setPrice((current) => current ?? candles[candles.length - 1].close);
    }
    setLoading(false);
  }, [symbol, assetType, chartInterval, indicators, fetchOlderCandles, variant]);

  useEffect(() => {
    const timer = setTimeout(() => loadChart(), 0);
    const onResize = () => {
      if (chartRef.current && containerRef.current) {
        try {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        } catch {
          // Ignore errors during resize
        }
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      try {
        chartRef.current?.remove();
      } catch {
        // Ignore errors during cleanup
      }
      chartRef.current = null;
      candleRef.current = null;
      areaRef.current = null;
      candleDataRef.current = [];
      latestCandleRef.current = null;
    };
  }, [loadChart]);

  // Real-time price updates via SSE with polling fallback
  useEffect(() => {
    const applyLiveQuote = (tick: {
      symbol: string;
      price: number;
      changePercent?: number | null;
      volume?: number | null;
      high24h?: number | null;
      low24h?: number | null;
      updatedAt?: string | number;
    }) => {
      if (!isSameMarketSymbol(tick.symbol, symbol)) return;
      const prevPrice = priceRef.current;

      setPrice(tick.price);
      if (tick.changePercent !== undefined && tick.changePercent !== null) {
        setPriceChange(tick.changePercent);
      }
      if (typeof tick.volume === "number") setVolume(tick.volume);
      if (typeof tick.high24h === "number") setHigh24h(tick.high24h);
      if (typeof tick.low24h === "number") setLow24h(tick.low24h);

      if (prevPrice !== null && tick.price !== prevPrice) {
        setPriceDirection(tick.price > prevPrice ? "up" : "down");
        setTimeout(() => setPriceDirection(null), 200);
      }

      updateLiveCandle(tick.price, tick.updatedAt);
    };

    const unsub = subscribeSSE((channel, data) => {
      if (channel !== "market") return;
      const tick = data as { symbol?: string; price?: number; changePercent?: number; updatedAt?: string };
      if (!tick.symbol || typeof tick.price !== "number") return;
      applyLiveQuote({ ...tick, symbol: tick.symbol, price: tick.price });
    });

    const unsubSync = subscribeRealtimeSync((payload) => {
      const tick = payload.quotes.find((quote) => isSameMarketSymbol(quote.symbol, symbol));
      if (!tick) return;
      applyLiveQuote(tick);
    });

    const poll = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&sync=true`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const json = await res.json().catch(() => null);
        if (json && json.success && json.data?.quote) {
          const newPrice = json.data.quote.price;
          applyLiveQuote({
            symbol: json.data.quote.symbol ?? symbol,
            price: newPrice,
            changePercent: json.data.quote.changePercent ?? 0,
            volume: json.data.quote.volume ?? 0,
            high24h: json.data.quote.high24h ?? 0,
            low24h: json.data.quote.low24h ?? 0,
            updatedAt: json.data.quote.updatedAt,
          });
        }
      } catch {
        // Polling is a best-effort fallback. SSE/realtime sync keep the chart alive.
      } finally {
        window.clearTimeout(timeout);
        pollInFlightRef.current = false;
      }
    }, 1000);

    return () => {
      unsub();
      unsubSync();
      clearInterval(poll);
    };
  }, [symbol, updateLiveCandle]);

  const toggleIndicator = (ind: (typeof INDICATORS)[number]) => {
    setIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  };

  const toggleFavorite = async () => {
    const key = `${symbol}:${assetType}`;
    if (favs.has(key)) {
      await secureFetch(`/api/favorites?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}`, {
        method: "DELETE",
      });
      setFavs((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    } else {
      await secureFetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ symbol, assetType, category: assetType === "crypto" ? "CRYPTO" : "STOCKS" }),
      });
      setFavs((s) => new Set(s).add(key));
    }
  };

  const ASSETS = [
    { symbol: "BTC/USD", assetType: "crypto", label: "BTC" },
    { symbol: "ETH/USD", assetType: "crypto", label: "ETH" },
    { symbol: "EUR/USD", assetType: "forex", label: "EURUSD" },
    { symbol: "XAU/USD", assetType: "commodity", label: "Gold" },
    { symbol: "AAPL", assetType: "stock", label: "AAPL" },
    { symbol: "NVDA", assetType: "stock", label: "NVDA" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ASSETS.map((a) => (
          <button
            key={a.symbol}
            type="button"
            onClick={() => {
              setSymbol(a.symbol);
              setAssetType(a.assetType);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-colors",
              symbol === a.symbol
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-muted-foreground hover:text-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleFavorite}
          className="ml-auto rounded-lg p-2 text-muted-foreground hover:text-emerald-400"
          title="Toggle favorite"
        >
          <Star className={cn("h-4 w-4", favs.has(`${symbol}:${assetType}`) && "fill-emerald-400 text-emerald-400")} />
        </button>
      </div>

      <div className="flex flex-wrap items-baseline gap-4">
        <div className="flex items-baseline gap-3">
          <span className={cn(
            "font-mono text-4xl font-bold tabular-nums px-2 py-1 rounded transition-all",
            priceDirection === "up" && "price-flash-up",
            priceDirection === "down" && "price-flash-down"
          )}>
            {price?.toFixed(2) ?? "—"}
          </span>
          <span className="font-mono text-base text-muted-foreground">{symbol}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all",
            priceChange >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error',
            priceDirection === "up" && "nudge-up",
            priceDirection === "down" && "nudge-down"
          )}>
            {priceChange >= 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a11 1 0 01-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            )}
            <span className="font-mono font-bold">{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%</span>
          </div>
          <span className="text-muted-foreground">Vol: {volume.toLocaleString()}</span>
          <span className="text-muted-foreground">24H: {low24h.toFixed(2)} - {high24h.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setChartInterval(iv)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium",
              chartInterval === iv ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-white/5"
            )}
          >
            {iv}
          </button>
        ))}
        {variant === "dashboard" && (
          <>
            <span className="mx-1 text-border">|</span>
            {INDICATORS.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndicator(ind)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium",
                  indicators.has(ind) ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-white/5"
                )}
              >
                {ind}
              </button>
            ))}
          </>
        )}
      </div>

      {variant !== "dashboard" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Price
            </button>
            <button
              type="button"
              className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Market cap
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Take chart snapshot"
              className="rounded-lg border border-border bg-background/80 px-2.5 py-2 text-sm hover:border-primary/50"
            >
              &#9633;
            </button>
            <button
              type="button"
              aria-label="Embed chart code"
              className="rounded-lg border border-border bg-background/80 px-2.5 py-2 text-sm hover:border-primary/50"
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              aria-label="Fit full chart"
              onClick={() => chartRef.current?.timeScale().fitContent()}
              className="rounded-lg border border-border bg-background/80 px-3 py-2 text-sm font-semibold hover:border-primary/50"
            >
              Full chart
            </button>
          </div>
        </div>
      )}

      <div className="dash-panel relative rounded-lg p-2">
        {loading && <div className="absolute inset-0 z-10 skeleton rounded-lg" />}
        <div ref={containerRef} className="w-full" style={{ height: variant === "dashboard" ? "400px" : "500px" }} />
      </div>
    </div>
  );
}

function computeSMA(data: number[], period: number) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function computeEMA(data: number[], period: number) {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (ema === null) ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    else ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function computeRSI(data: number[], period = 14) {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) { result.push(null); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = data[j] - data[j - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    result.push(100 - 100 / (1 + (losses === 0 ? 100 : gains / losses)));
  }
  return result;
}

function computeMACD(data: number[]) {
  const ema12 = computeEMA(data, 12);
  const ema26 = computeEMA(data, 26);
  const macd = ema12.map((v, i) => (v != null && ema26[i] != null ? v - ema26[i]! : null));
  return { macd };
}

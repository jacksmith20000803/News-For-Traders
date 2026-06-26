"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { EconomicEventType, EventImpact } from "@prisma/client";

interface CalendarEvent {
  id: string;
  type: EconomicEventType;
  title: string;
  country: string;
  scheduledAt: string;
  impact: EventImpact;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  localTime: string;
}

const TYPE_FILTERS: { value: EconomicEventType | ""; label: string }[] = [
  { value: "", label: "All Events" },
  { value: "CPI", label: "CPI" },
  { value: "NFP", label: "NFP" },
  { value: "FOMC", label: "FOMC" },
  { value: "GDP", label: "GDP" },
  { value: "UNEMPLOYMENT", label: "Unemployment" },
];

const IMPACT_FILTERS: { value: EventImpact | ""; label: string }[] = [
  { value: "", label: "All Impact" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const TIMEZONES = [
  "America/New_York",
  "Europe/London",
  "Asia/Tokyo",
  "UTC",
];

const IMPACT_COLORS: Record<EventImpact, string> = {
  HIGH: "text-destructive bg-destructive/10 border-destructive/30",
  MEDIUM: "text-warning bg-warning/10 border-warning/30",
  LOW: "text-muted-foreground bg-white/5 border-white/10",
};

export function CalendarView() {
  const [type, setType] = useState("");
  const [impact, setImpact] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (impact) params.set("impact", impact);
      params.set("timezone", timezone);

      fetch(`/api/calendar?${params}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setEvents(json.data.events ?? []);
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [type, impact, timezone]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="btn-3d rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs appearance-none cursor-pointer"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setType(f.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                type === f.value ? "bg-cyan-500/15 text-cyan-400" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {IMPACT_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setImpact(f.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                impact === f.value ? "bg-cyan-500/15 text-cyan-400" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`cal-sk-${i}`} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No upcoming events match filters</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="dash-panel flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-4"
            >
              <div className="min-w-[140px]">
                <p className="font-mono text-xs text-cyan-400">{event.localTime}</p>
                <p className="text-[10px] text-muted-foreground">{event.country}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-white/5">{event.type}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", IMPACT_COLORS[event.impact])}>
                    {event.impact}
                  </span>
                </div>
                <p className="text-sm font-medium">{event.title}</p>
              </div>
              <div className="flex gap-4 text-xs font-mono tabular-nums text-muted-foreground">
                {event.previous && <span>Prev: {event.previous}</span>}
                {event.forecast && <span>Fcst: {event.forecast}</span>}
                {event.actual && <span className="text-accent">Act: {event.actual}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2 } from "lucide-react";
import { readJsonResponse } from "@/lib/api/client";
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

const PAGE_SIZE = 6;
type ViewMode = "list" | "card";

function EventMetrics({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs font-mono tabular-nums text-muted-foreground">
      {event.previous && <span>Prev: {event.previous}</span>}
      {event.forecast && <span>Fcst: {event.forecast}</span>}
      {event.actual && <span className="text-accent">Act: {event.actual}</span>}
    </div>
  );
}

function CalendarPager({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/75 px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground">
        Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous calendar page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-20 rounded-xl bg-muted px-3 py-2 text-center text-xs font-bold">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next calendar page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function CalendarView() {
  const [type, setType] = useState("");
  const [impact, setImpact] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const timezoneMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (impact) params.set("impact", impact);
      params.set("timezone", timezone);

      fetch(`/api/calendar?${params}`)
        .then((r) =>
          readJsonResponse<{
            success: boolean;
            error?: string;
            data?: { events?: CalendarEvent[] };
          }>(r)
        )
        .then((json) => {
          if (cancelled) return;
          if (!json.success) throw new Error(json.error ?? "Could not load calendar events");
          setEvents(json.data?.events ?? []);
        })
        .catch((loadError) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : "Could not load calendar events");
            setEvents([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, impact, timezone]);

  useEffect(() => {
    if (!timezoneOpen) return;

    const closeOnOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (target && timezoneMenuRef.current?.contains(target)) return;
      setTimezoneOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("focusin", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("focusin", closeOnOutside);
    };
  }, [timezoneOpen]);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEvents = useMemo(
    () => events.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, events]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[13rem]" ref={timezoneMenuRef}>
          <button
            type="button"
            onClick={() => setTimezoneOpen((open) => !open)}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left text-xs font-extrabold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-4",
              timezoneOpen
                ? "border-blue-400/60 bg-blue-500/10 text-blue-700 focus-visible:ring-blue-500/15 dark:border-blue-300/45 dark:bg-blue-500/12 dark:text-blue-200"
                : "border-gray-200 bg-white/90 text-gray-900 hover:border-blue-300/60 hover:bg-white focus-visible:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-blue-300/30 dark:hover:bg-white/[0.07]"
            )}
            aria-haspopup="listbox"
            aria-expanded={timezoneOpen}
          >
            <span className="truncate">{timezone.replace("_", " ")}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                timezoneOpen && "rotate-180"
              )}
            />
          </button>
          {timezoneOpen && (
            <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl shadow-black/10 ring-1 ring-blue-500/5 dark:border-white/10 dark:bg-[#0b0f12] dark:shadow-black/40 dark:ring-blue-300/10">
              <div className="space-y-1" role="listbox" aria-label="Select calendar timezone">
                {TIMEZONES.map((tz) => (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => {
                      setTimezone(tz);
                      setPage(1);
                      setTimezoneOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors",
                      timezone === tz
                        ? "bg-blue-500/10 text-blue-700 ring-1 ring-blue-400/25 dark:text-blue-200"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/8"
                    )}
                    role="option"
                    aria-selected={timezone === tz}
                  >
                    {tz.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => {
                setType(f.value);
                setPage(1);
              }}
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
              onClick={() => {
                setImpact(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                impact === f.value ? "bg-cyan-500/15 text-cyan-400" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex rounded-2xl border border-border bg-card/80 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setViewMode("list");
              setPage(1);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors",
              viewMode === "list" ? "bg-blue-500/15 text-blue-600 dark:text-blue-300" : "text-muted-foreground hover:bg-muted"
            )}
            aria-pressed={viewMode === "list"}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("card");
              setPage(1);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors",
              viewMode === "card" ? "bg-blue-500/15 text-blue-600 dark:text-blue-300" : "text-muted-foreground hover:bg-muted"
            )}
            aria-pressed={viewMode === "card"}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
      </div>

      {loading ? (
        <div className={viewMode === "list" ? "space-y-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={`cal-sk-${i}`} className={cn("skeleton rounded-xl", viewMode === "list" ? "h-16" : "h-44")} />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          <Loader2 className="h-4 w-4" />
          {error}
        </div>
      ) : events.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No upcoming events match filters</p>
      ) : viewMode === "card" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paginatedEvents.map((event) => (
              <article key={event.id} className="dash-panel flex min-h-44 flex-col justify-between rounded-2xl p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-cyan-500">{event.localTime}</p>
                      <p className="text-[11px] text-muted-foreground">{event.country}</p>
                    </div>
                    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-extrabold", IMPACT_COLORS[event.impact])}>
                      {event.impact}
                    </span>
                  </div>
                  <div>
                    <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold">{event.type}</span>
                    <h3 className="mt-3 text-sm font-bold leading-6 text-foreground">{event.title}</h3>
                  </div>
                </div>
                <EventMetrics event={event} />
              </article>
            ))}
          </div>
          <CalendarPager
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={events.length}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
        <div className="space-y-2">
          {paginatedEvents.map((event) => (
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
              <EventMetrics event={event} />
            </div>
          ))}
        </div>
        <CalendarPager
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={events.length}
          onPageChange={setPage}
        />
        </>
      )}
    </div>
  );
}

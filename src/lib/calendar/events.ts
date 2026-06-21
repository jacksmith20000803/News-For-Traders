import { db } from "@/lib/db";
import type { EconomicEventType, EventImpact } from "@prisma/client";
import { unstable_cache } from "next/cache";

export interface CalendarFilters {
  type?: EconomicEventType;
  impact?: EventImpact;
  from?: Date;
  to?: Date;
  country?: string;
}

export async function getEconomicEvents(filters: CalendarFilters = {}) {
  const now = filters.from ?? new Date();
  const end = filters.to ?? new Date(Date.now() + 90 * 24 * 3600000);

  return db.economicEvent.findMany({
    where: {
      scheduledAt: { gte: now, lte: end },
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.impact ? { impact: filters.impact } : {}),
      ...(filters.country ? { country: filters.country } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
}

export const getCachedCalendar = unstable_cache(
  async (type?: string, impact?: string) => {
    return getEconomicEvents({
      type: type as EconomicEventType | undefined,
      impact: impact as EventImpact | undefined,
    });
  },
  ["economic-calendar"],
  { revalidate: 300 }
);

export function formatEventInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export const EVENT_TYPE_LABELS: Record<EconomicEventType, string> = {
  CPI: "CPI",
  NFP: "Non-Farm Payrolls",
  FOMC: "FOMC",
  GDP: "GDP",
  UNEMPLOYMENT: "Unemployment",
  OTHER: "Other",
};

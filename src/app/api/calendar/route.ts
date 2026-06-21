import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getEconomicEvents, formatEventInTimezone } from "@/lib/calendar/events";
import { calendarQuerySchema } from "@/lib/validations/trader";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = calendarQuerySchema.parse({
      type: searchParams.get("type") ?? undefined,
      impact: searchParams.get("impact") ?? undefined,
      country: searchParams.get("country") ?? undefined,
    });

    const timezone = searchParams.get("timezone") ?? "America/New_York";
    const events = await getEconomicEvents({
      type: params.type,
      impact: params.impact,
      country: params.country,
    });

    const formatted = events.map((e) => ({
      ...e,
      localTime: formatEventInTimezone(e.scheduledAt, timezone),
      utcTime: e.scheduledAt.toISOString(),
    }));

    return apiSuccess({ events: formatted, timezone });
  } catch (error) {
    return handleApiError(error);
  }
}

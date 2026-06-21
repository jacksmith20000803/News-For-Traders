import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata = { title: "Economic Calendar" };

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Economic Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CPI, NFP, FOMC, GDP, and unemployment releases with impact filtering
        </p>
      </div>
      <CalendarView />
    </div>
  );
}

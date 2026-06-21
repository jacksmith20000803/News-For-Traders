"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";

export function NotificationBellWrapper() {
  return (
    <>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Notifications
      </h3>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <span className="text-xs text-muted-foreground">Real-time updates</span>
      </div>
    </>
  );
}

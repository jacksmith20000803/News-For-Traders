import { redirect } from "next/navigation";
import { connection } from "next/server";
import { NotificationsManager } from "@/components/notifications/notifications-manager";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const PAGE_SIZE = 12;

export default async function NotificationsPage() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const where = {
    userId: user.id,
    NOT: { title: "Market Data Updated" },
  };

  const [notifications, unreadCount, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    db.notification.count({ where: { ...where, read: false } }),
    db.notification.count({ where }),
  ]);

  const initialData = {
    notifications: notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    })),
    unreadCount,
    pagination: {
      page: 1,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review alerts, switch between list and card views, and remove old notifications.
        </p>
      </div>

      <NotificationsManager initialData={initialData} />
    </div>
  );
}

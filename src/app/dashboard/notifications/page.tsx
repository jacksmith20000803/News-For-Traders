import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
      NOT: { title: "Market Data Updated" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Replies, mentions, and alerts will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={n.read ? "opacity-70" : ""}>
              <CardContent className="p-4 flex justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{n.type}</Badge>
                    {!n.read && <Badge variant="primary">New</Badge>}
                  </div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelative(n.createdAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

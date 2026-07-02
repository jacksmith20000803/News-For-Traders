import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export default async function ActivityPage() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activities = await db.userActivity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold mb-6">Activity History</h1>
      {activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Your actions on the platform will be logged here."
        />
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex justify-between">
                <span className="text-sm font-medium">{a.action}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(a.createdAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

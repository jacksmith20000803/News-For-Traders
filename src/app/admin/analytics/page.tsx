import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [newUsers, newArticles, newDiscussions, totalUsers] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
    db.article.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.discussion.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <p className="text-muted-foreground mb-6">Last 30 days engagement overview</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: totalUsers },
          { label: "New Users (30d)", value: newUsers },
          { label: "New Articles (30d)", value: newArticles },
          { label: "New Discussions (30d)", value: newDiscussions },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

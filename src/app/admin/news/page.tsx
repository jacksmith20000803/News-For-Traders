import Link from "next/link";
import { AdminNewsManagement } from "@/components/admin/admin-news-management";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";

export default async function AdminNewsPage() {
  await requireAdminPage();

  const [news, totalNews, sources] = await Promise.all([
    db.news.findMany({
      include: {
        source: { select: { id: true, name: true, reliabilityScore: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 12,
    }),
    db.news.count(),
    db.newsSource.findMany({ orderBy: { name: "asc" } }),
  ]);

  const initialData = {
    items: news.map((item) => ({
      ...item,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    pagination: {
      page: 1,
      limit: 12,
      total: totalNews,
      totalPages: Math.max(1, Math.ceil(totalNews / 12)),
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">News Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review, search, and remove news items from the platform feed.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          Back
        </Link>
      </div>

      <Card className="mb-6 bg-card/95">
        <CardHeader>
          <CardTitle>Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <Badge key={source.id} variant="outline">
                {source.name} ({Math.round(source.reliabilityScore * 100)}%)
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <AdminNewsManagement initialData={initialData} />
    </div>
  );
}

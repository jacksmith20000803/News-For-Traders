import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IMPORTANCE_CONFIG, RELIABILITY_CONFIG } from "@/lib/constants";
import Link from "next/link";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";

export default async function AdminNewsPage() {
  await requireAdminPage();

  const [news, sources] = await Promise.all([
    db.news.findMany({
      include: { source: true, category: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
    db.newsSource.findMany(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">News Management</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <Badge key={s.id} variant="outline">
                {s.name} ({Math.round(s.reliabilityScore * 100)}%)
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>News Items ({news.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="border-b border-border pb-3">
              <p className="font-medium">{item.headline}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{item.source.name}</Badge>
                <Badge className={IMPORTANCE_CONFIG[item.importance as ImportanceLevel].bg}>
                  {IMPORTANCE_CONFIG[item.importance as ImportanceLevel].label}
                </Badge>
                <Badge variant="outline" className={RELIABILITY_CONFIG[item.reliabilityStatus as ReliabilityStatus].color}>
                  {RELIABILITY_CONFIG[item.reliabilityStatus as ReliabilityStatus].label}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

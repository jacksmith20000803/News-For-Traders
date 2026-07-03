import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AdminArticleManagement } from "@/components/admin/admin-article-management";
import Link from "next/link";

export const metadata = { title: "Community Articles Management" };

export default async function AdminArticlesPage() {
  await requireAdminPage();

  const limit = 12;
  const [items, total] = await Promise.all([
    db.article.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            country: true,
            timezone: true,
            registrationAudit: { select: { country: true, city: true, deviceType: true, browser: true, os: true } },
            visitorActivities: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { country: true, region: true, city: true, timezone: true },
            },
          },
        },
        tags: { include: { tag: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    db.article.count(),
  ]);

  const serializedItems = items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Community Articles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve, reject, or remove community articles with author notifications.
          </p>
        </div>
        <Link href="/admin" className="inline-flex rounded-2xl border border-border bg-card/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground">
          Back to Dashboard
        </Link>
      </div>

      <AdminArticleManagement
        initialData={{
          items: serializedItems,
          pagination: {
            page: 1,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }}
      />
    </div>
  );
}

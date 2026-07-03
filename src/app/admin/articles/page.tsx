import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AdminArticleManagement } from "@/components/admin/admin-article-management";

export const metadata = { title: "Community Articles Management" };

export default async function AdminArticlesPage() {
  await requireAdminPage();

  const limit = 12;
  const [items, total] = await Promise.all([
    db.article.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Community Articles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve, reject, or remove community articles with author notifications.
        </p>
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

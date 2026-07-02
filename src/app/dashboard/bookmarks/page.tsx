import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Bookmark } from "lucide-react";
import Link from "next/link";

export default async function BookmarksPage() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    include: {
      news: { include: { source: true } },
      article: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold mb-6">Saved Items</h1>
      {bookmarks.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved items"
          description="Bookmark news and articles from the dashboard to find them here."
        />
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4">
                {b.news && (
                  <Link href={`/news/${b.news.id}`} className="font-medium hover:text-primary">
                    {b.news.headline}
                  </Link>
                )}
                {b.article && (
                  <Link href={`/knowledge/${b.article.slug}`} className="font-medium hover:text-primary">
                    {b.article.title}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

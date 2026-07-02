import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { POST_CATEGORY_LABELS } from "@/lib/constants";
import { formatRelative } from "@/lib/utils";
import { CommentSection } from "@/components/content/comment-section";
import type { PostCategory } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { slug } = await params;
  const article = await db.article.findUnique({ where: { slug }, select: { title: true } });
  return { title: article?.title ?? "Article" };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { slug } = await params;

  const article = await db.article.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: {
      author: { select: { id: true, name: true, reputation: true } },
      tags: { include: { tag: true } },
      comments: {
        where: { parentId: null, isRemoved: false },
        include: {
          author: { select: { id: true, name: true, reputation: true } },
          replies: {
            where: { isRemoved: false },
            include: { author: { select: { id: true, name: true, reputation: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!article) notFound();

  await db.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/knowledge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to knowledge plaza
      </Link>

      <article className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">
            {POST_CATEGORY_LABELS[article.category as PostCategory]}
          </Badge>
          {article.featured && <Badge variant="warning">Featured</Badge>}
          {article.tags.map(({ tag }) => (
            <Badge key={tag.id} variant="outline">{tag.name}</Badge>
          ))}
        </div>

        <h1 className="text-3xl font-bold">{article.title}</h1>

        <p className="text-sm text-muted-foreground">
          {article.author.name} · Rep {article.author.reputation} ·{" "}
          {formatRelative(article.publishedAt ?? article.createdAt)} · {article.viewCount} views
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
          {article.content}
        </div>

        <section className="pt-6 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          <CommentSection
            articleId={article.id}
            comments={article.comments.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
              replies: c.replies.map((r) => ({
                ...r,
                createdAt: r.createdAt.toISOString(),
              })),
            }))}
          />
        </section>
      </article>
    </div>
  );
}

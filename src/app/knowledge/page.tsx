import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, PenLine } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { POST_CATEGORY_LABELS } from "@/lib/constants";
import type { PostCategory } from "@prisma/client";
import { isDatabaseConnectivityError } from "@/lib/db-errors";

export const metadata = { title: "Knowledge Plaza" };

type KnowledgeArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: PostCategory;
  featured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string; reputation: number };
  _count: { likes: number; comments: number };
};

async function getPublishedArticles(): Promise<KnowledgeArticle[]> {
  try {
    return await db.article.findMany({
      where: { status: "PUBLISHED" },
      include: {
        author: { select: { id: true, name: true, reputation: true } },
        tags: { include: { tag: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 20,
    });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;

    return [
      {
        id: "fallback-knowledge-market-discipline",
        title: "Market research is reconnecting",
        slug: "market-research-reconnecting",
        excerpt:
          "Community research is temporarily unavailable. The page will automatically use live articles again when the database connection returns.",
        category: "RISK_MANAGEMENT",
        featured: false,
        publishedAt: new Date(),
        createdAt: new Date(),
        author: { id: "system", name: "TRADX", reputation: 100 },
        _count: { likes: 0, comments: 0 },
      },
    ];
  }
}

export default async function KnowledgePage() {
  const articles = await getPublishedArticles();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Knowledge & Experience Plaza</h1>
          </div>
          <p className="text-muted-foreground">
            Share analyses, market observations, and lessons learned with the community.
          </p>
        </div>
        <Link
          href="/knowledge/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <PenLine className="h-4 w-4" />
          Publish Analysis
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(POST_CATEGORY_LABELS).map(([key, label]) => (
          <Badge key={key} variant="outline">{label}</Badge>
        ))}
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No published articles yet.{" "}
            <Link href="/knowledge/new" className="text-primary hover:underline">
              Publish your first analysis
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <Card key={article.id} className="hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="primary">
                    {POST_CATEGORY_LABELS[article.category as PostCategory]}
                  </Badge>
                  {article.featured && <Badge variant="warning">Featured</Badge>}
                </div>
                <CardTitle className="text-lg">
                  <Link href={`/knowledge/${article.slug}`} className="hover:text-primary">
                    {article.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {article.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {article.author.name} · Rep {article.author.reputation}
                  </span>
                  <span>{formatRelative(article.publishedAt ?? article.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

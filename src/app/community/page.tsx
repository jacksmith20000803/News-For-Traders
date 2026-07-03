import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare, PlusCircle } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { COMMUNITY_RULES, POST_CATEGORY_LABELS } from "@/lib/constants";
import type { ContentStatus, PostCategory } from "@prisma/client";
import { isDatabaseConnectivityError } from "@/lib/db-errors";

export const metadata = { title: "Community" };

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    category?: string;
    status?: string;
  }>;
};

const statusFilters: Array<ContentStatus | "ALL"> = ["ALL", "PENDING", "PUBLISHED", "REJECTED", "ARCHIVED", "DRAFT"];

export default async function CommunityPage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  const tab = params.tab === "my" ? "my" : "all";
  const category = normalizeCategory(params.category);
  const status = normalizeStatus(params.status);

  const [articles, myArticles] = await Promise.all([
    getPublishedArticles(category),
    user ? getMyArticles(user.id, status) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Community</h1>
          </div>
          <p className="text-muted-foreground">
            Market articles and professional discussion for high-quality analysis.
          </p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(16,185,129,0.24)] transition hover:bg-emerald-500 active:scale-95"
        >
          <PlusCircle className="h-4 w-4" />
          Submit Article
        </Link>
      </div>

      <Card className="mb-8 border-accent/30 bg-accent/5">
        <CardHeader>
          <CardTitle className="text-base">Community Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {COMMUNITY_RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">•</span>
                {rule}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-border bg-card/95 p-1 shadow-inner">
          <TabLink active={tab === "all"} href="/community">
            All Community
          </TabLink>
          <TabLink active={tab === "my"} href="/community?tab=my">
            My Articles
          </TabLink>
        </div>
        {tab === "all" ? (
          <FilterLinks base="/community" active={category ?? "ALL"} values={["ALL", ...Object.keys(POST_CATEGORY_LABELS)]} param="category" />
        ) : (
          <FilterLinks base="/community?tab=my" active={status} values={statusFilters} param="status" />
        )}
      </div>

      {tab === "all" ? (
        <ArticleList articles={articles} empty="No approved community articles match this filter yet." />
      ) : user ? (
        <ArticleList articles={myArticles} empty="You have not submitted any articles for this status yet." showStatus />
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Sign in to view and manage your submitted articles.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function getPublishedArticles(category: PostCategory | null) {
  try {
    return await db.article.findMany({
      where: {
        status: "PUBLISHED",
        ...(category ? { category } : {}),
      },
      include: {
        author: { select: { id: true, name: true, reputation: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 24,
    });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    return [];
  }
}

async function getMyArticles(userId: string, status: ContentStatus | "ALL") {
  try {
    return await db.article.findMany({
      where: {
        authorId: userId,
        ...(status !== "ALL" ? { status } : {}),
      },
      include: {
        author: { select: { id: true, name: true, reputation: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    return [];
  }
}

function TabLink({ active, href, children }: { active: boolean; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

function FilterLinks({
  base,
  active,
  values,
  param,
}: {
  base: string;
  active: string;
  values: string[];
  param: string;
}) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border bg-card/95 p-2">
      {values.map((value) => {
        const label =
          value === "ALL"
            ? "All"
            : param === "category"
              ? POST_CATEGORY_LABELS[value as PostCategory]
              : value.toLowerCase();
        const separator = base.includes("?") ? "&" : "?";
        const href = value === "ALL" ? base : `${base}${separator}${param}=${value}`;
        return (
          <Link
            key={value}
            href={href}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              active === value ? "bg-emerald-600 text-white" : "bg-background/80 text-muted-foreground hover:text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function ArticleList({
  articles,
  empty,
  showStatus = false,
}: {
  articles: Awaited<ReturnType<typeof getPublishedArticles>>;
  empty: string;
  showStatus?: boolean;
}) {
  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {articles.map((article) => (
        <Card key={article.id} className="bg-card/95 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl">
          <CardContent className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{POST_CATEGORY_LABELS[article.category]}</Badge>
                  {showStatus ? <Badge variant={article.status === "PUBLISHED" ? "success" : article.status === "REJECTED" || article.status === "ARCHIVED" ? "danger" : "warning"}>{article.status.toLowerCase()}</Badge> : null}
                </div>
                <h2 className="line-clamp-2 text-lg font-bold text-foreground">{article.title}</h2>
              </div>
              <FileText className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt ?? article.content}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{article.author.name} · Rep {article.author.reputation}</span>
              <span>{formatRelative(article.publishedAt ?? article.createdAt)}</span>
              <span>{article._count.likes} likes</span>
              <span>{article._count.comments} comments</span>
            </div>
            {showStatus && (article.status === "REJECTED" || article.status === "ARCHIVED") ? (
              <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-200">
                Check notifications for the moderation reason.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function normalizeCategory(value: string | undefined): PostCategory | null {
  return value && value in POST_CATEGORY_LABELS ? (value as PostCategory) : null;
}

function normalizeStatus(value: string | undefined): ContentStatus | "ALL" {
  return statusFilters.includes(value as ContentStatus) ? (value as ContentStatus) : "ALL";
}

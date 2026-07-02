import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { IMPORTANCE_CONFIG, RELIABILITY_CONFIG } from "@/lib/constants";
import { formatRelative } from "@/lib/utils";
import { CommentSection } from "@/components/content/comment-section";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  Clock,
  MessageSquare,
  Layers,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const news = await db.news.findUnique({ where: { id }, select: { headline: true } });
  return { title: news?.headline ?? "News" };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  const news = await db.news.findUnique({
    where: { id },
    include: {
      source: true,
      category: true,
      assets: true,
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

  if (!news) notFound();

  const relatedNews = await db.news.findMany({
    where: {
      id: { not: news.id },
      OR: [
        { categoryId: news.categoryId },
        { assets: { some: { symbol: { in: news.assets.map((a) => a.symbol) } } } },
      ],
    },
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to terminal
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <article className="space-y-6 lg:col-span-2">
          {/* Headline section */}
          <div className="dash-panel dash-panel-glow rounded-2xl p-6">
            {news.imageUrl && (
              <div className="mb-6 relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-white/5">
                <Image
                  src={news.imageUrl}
                  alt={news.headline}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge className={IMPORTANCE_CONFIG[news.importance as ImportanceLevel].bg}>
                {IMPORTANCE_CONFIG[news.importance as ImportanceLevel].label}
              </Badge>
              <Badge
                variant="outline"
                className={RELIABILITY_CONFIG[news.reliabilityStatus as ReliabilityStatus].color}
              >
                {RELIABILITY_CONFIG[news.reliabilityStatus as ReliabilityStatus].label}
              </Badge>
              {news.isPinned && <Badge variant="warning">Pinned</Badge>}
            </div>

            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{news.headline}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{news.source.name}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatRelative(news.publishedAt)}
              </span>
              {news.sourceUrl && (
                <>
                  <span>·</span>
                  <a
                    href={news.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Market impact */}
          {news.assets.length > 0 && (
            <section className="dash-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Affected Assets
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {news.assets.map((a) => (
                  <div
                    key={`asset-${a.id}`}
                    className="rounded-xl border border-white/8 bg-white/5 px-3 py-2"
                  >
                    <span className="font-mono text-sm font-semibold text-cyan-400">{a.symbol}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{a.assetType}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Summary / content */}
          {(news.summary || news.content) && (
            <section className="dash-panel rounded-2xl p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Market Impact
              </h2>
              {news.summary && (
                <p className="text-base leading-relaxed text-muted-foreground">{news.summary.replace(/<[^>]*>/g, '')}</p>
              )}
              {news.content && (
                <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{news.content.replace(/<[^>]*>/g, '')}</div>
              )}
            </section>
          )}

          {/* AI explanation */}
          <section className="dash-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                AI Explanation
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Get an AI-powered interpretation of this event and its market implications.
            </p>
            <Link
              href={`/ai?q=${encodeURIComponent(news.headline)}`}
              className="inline-flex rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-cyan-500 hover:to-blue-500"
            >
              Analyze with AI →
            </Link>
          </section>

          {/* Community discussion */}
          <section id="comments" className="dash-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Community Discussion
              </h2>
              <Badge variant="outline">{news.comments.length}</Badge>
            </div>
            <CommentSection
              newsId={news.id}
              comments={news.comments.map((c) => ({
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

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Timeline */}
          <div className="dash-panel rounded-2xl p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                <div>
                  <p className="text-xs font-medium">Published</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(news.publishedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Ingested</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(news.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Related news */}
          {relatedNews.length > 0 && (
            <div className="dash-panel rounded-2xl p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Related News
              </h3>
              <div className="space-y-2">
                {relatedNews.map((r) => (
                  <Link
                    key={r.id}
                    href={`/news/${r.id}`}
                    className="block rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/5 hover:text-cyan-400 line-clamp-2"
                  >
                    {r.headline}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Historical context */}
          <div className="dash-panel rounded-2xl p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Historical Context
            </h3>
            <p className="text-xs text-muted-foreground">
              Historical context and pattern analysis will be available when sufficient data is ingested.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

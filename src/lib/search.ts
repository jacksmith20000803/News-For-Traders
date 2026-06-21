import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface SearchParams {
  q: string;
  type?: "all" | "news" | "articles" | "discussions" | "users" | "comments";
  page?: number;
  limit?: number;
  sort?: "relevance" | "newest";
}

export async function globalSearch(params: SearchParams) {
  const q = params.q.trim();
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 10, 50);
  const skip = (page - 1) * limit;
  const type = params.type ?? "all";

  const results: Record<string, unknown> = {};

  const mode = Prisma.QueryMode.insensitive;

  if (type === "all" || type === "news") {
    const [items, total] = await Promise.all([
      db.news.findMany({
        where: {
          OR: [
            { headline: { contains: q, mode } },
            { summary: { contains: q, mode } },
          ],
        },
        include: { source: { select: { name: true } }, assets: { select: { symbol: true } } },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      db.news.count({
        where: {
          OR: [
            { headline: { contains: q, mode } },
            { summary: { contains: q, mode } },
          ],
        },
      }),
    ]);
    results.news = { items, total, page, limit };
  }

  if (type === "all" || type === "articles") {
    const where = {
      status: "PUBLISHED" as const,
      OR: [
        { title: { contains: q, mode } },
        { content: { contains: q, mode } },
      ],
    };
    const [items, total] = await Promise.all([
      db.article.findMany({
        where,
        include: { author: { select: { id: true, name: true, reputation: true } } },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      db.article.count({ where }),
    ]);
    results.articles = { items, total, page, limit };
  }

  if (type === "all" || type === "discussions") {
    const where = {
      OR: [
        { title: { contains: q, mode } },
        { content: { contains: q, mode } },
      ],
    };
    const [items, total] = await Promise.all([
      db.discussion.findMany({
        where,
        include: { author: { select: { id: true, name: true, reputation: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.discussion.count({ where }),
    ]);
    results.discussions = { items, total, page, limit };
  }

  if (type === "all" || type === "users") {
    const where = {
      isBanned: false,
      deletedAt: null,
      name: { contains: q, mode },
    };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          avatar: true,
          reputation: true,
          contributionCount: true,
          createdAt: true,
        },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);
    results.users = { items, total, page, limit };
  }

  if (type === "all" || type === "comments") {
    const where = {
      isRemoved: false,
      content: { contains: q, mode },
    };
    const [items, total] = await Promise.all([
      db.comment.findMany({
        where,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.comment.count({ where }),
    ]);
    results.comments = { items, total, page, limit };
  }

  return results;
}

export async function logAIUsage(params: {
  userId: string;
  conversationId?: string;
  promptTokens: number;
  completionTokens: number;
  model?: string;
}) {
  return db.aIUsageLog.create({ data: params });
}

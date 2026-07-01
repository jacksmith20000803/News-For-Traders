import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validations/content";
import { INTEREST_TO_NEWS_SLUGS } from "@/lib/constants";
import { ImportanceLevel, Prisma } from "@prisma/client";
import { z } from "zod";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { getFallbackNews } from "@/lib/fallback-data";
import { ingestNewsFromProviders } from "@/lib/providers/news/ingest";

const NEWS_STALE_AFTER_MS = 10 * 60 * 1000;
const NEWS_REFRESH_COOLDOWN_MS = 60 * 1000;
let lastNewsRefreshAttempt = 0;
let newsRefreshInFlight: Promise<unknown> | null = null;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const newsQuerySchema = paginationSchema.extend({
  importance: z.nativeEnum(ImportanceLevel).optional(),
  coin: z.string().trim().min(1).max(30).optional(),
  search: z.string().trim().max(200).optional(),
  favorites: z.enum(["true", "false"]).optional(),
  lite: z.enum(["true", "false"]).optional(),
  fast: z.enum(["true", "false"]).optional(),
  personalized: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = newsQuerySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      importance: searchParams.get("importance") ?? undefined,
      coin: searchParams.get("coin") || undefined,
      search: searchParams.get("search") || undefined,
      favorites: searchParams.get("favorites") === "true" ? "true" : "false",
      lite: searchParams.get("lite") === "true" ? "true" : "false",
      fast: searchParams.get("fast") === "true" ? "true" : "false",
      personalized: searchParams.get("personalized") === "true" ? "true" : "false",
    });

    const favoriteOnly = params.favorites === "true";
    const lite = params.lite === "true" && !favoriteOnly;
    const fast = params.fast === "true" || lite;
    const includePersonalized = params.personalized === "true";

    const where: Prisma.NewsWhereInput = {};
    if (params.importance) where.importance = params.importance;
    if (params.coin) {
      const normalizedCoin = params.coin.toUpperCase().replace(/\/USD$/, "");
      where.assets = {
        some: {
          OR: [
            { symbol: { equals: normalizedCoin, mode: "insensitive" } },
            { symbol: { equals: `${normalizedCoin}/USD`, mode: "insensitive" } },
          ],
        },
      };
    }
    if (params.search) {
      where.OR = [
        { headline: { contains: params.search, mode: "insensitive" } },
        { summary: { contains: params.search, mode: "insensitive" } },
      ];
    }

    await refreshNewsIfStale();

    if (lite) {
      const news = await db.news.findMany({
        where,
        select: {
          id: true,
          headline: true,
          summary: true,
          publishedAt: true,
          importance: true,
          reliabilityStatus: true,
          imageUrl: true,
          source: { select: { name: true } },
          assets: { select: { symbol: true, assetType: true } },
        },
        orderBy: { publishedAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      });

      const response = apiSuccess({
        news,
        personalized: null,
        favoriteNewsIds: [],
        pagination: {
          page: params.page,
          limit: params.limit,
          total: news.length,
          totalPages: news.length < params.limit ? params.page : params.page + 1,
        },
      });
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    const user = await getCurrentUser();
    if (favoriteOnly && !user) {
      const response = apiSuccess({
        news: [],
        personalized: null,
        favoriteNewsIds: [],
        pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 0 },
      });
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    if (favoriteOnly && user) {
      where.bookmarks = { some: { userId: user.id } };
    }

    const newsWithProbe = await db.news.findMany({
      where,
      include: {
        source: fast
          ? { select: { name: true } }
          : { select: { name: true, reliabilityScore: true } },
        category: fast ? false : { select: { name: true, slug: true } },
        assets: { select: { symbol: true, assetType: true } },
        _count: fast ? false : { select: { comments: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: fast ? params.limit + 1 : params.limit,
    });

    const hasMore = fast && newsWithProbe.length > params.limit;
    const news = hasMore ? newsWithProbe.slice(0, params.limit) : newsWithProbe;
    const total = fast ? null : await db.news.count({ where });

    const favoriteNewsIds = user
      ? (
          await db.bookmark.findMany({
            where: {
              userId: user.id,
              newsId: { in: news.map((item) => item.id) },
            },
            select: { newsId: true },
          })
        )
          .map((bookmark) => bookmark.newsId)
          .filter((id): id is string => Boolean(id))
      : [];

    let personalized = null;
    if (user && includePersonalized) {
      const interests = await db.userInterest.findMany({
        where: { userId: user.id },
        select: { category: true },
      });

      if (interests.length > 0) {
        const slugs = [
          ...new Set(
            interests.flatMap((i) => INTEREST_TO_NEWS_SLUGS[i.category] ?? [])
          ),
        ];

        personalized = await db.news.findMany({
          where: {
            category: { slug: { in: slugs } },
          },
          select: {
            id: true,
            headline: true,
            summary: true,
            source: { select: { name: true, reliabilityScore: true } },
            category: { select: { name: true, slug: true } },
            assets: { select: { symbol: true, assetType: true } },
            _count: { select: { comments: true } },
            publishedAt: true,
            importance: true,
            reliabilityStatus: true,
            imageUrl: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 6,
        });
      }
    }

    const response = apiSuccess({
      news,
      personalized,
      favoriteNewsIds,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: fast
          ? hasMore
            ? params.page + 1
            : params.page
          : Math.ceil((total ?? 0) / params.limit),
      },
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 12)));
      const page = Math.max(1, Number(searchParams.get("page") ?? 1));
      const favoriteOnly = searchParams.get("favorites") === "true";
      const news = favoriteOnly ? [] : getFallbackNews(limit);

      const response = apiSuccess({
        news,
        personalized: null,
        favoriteNewsIds: [],
        degraded: true,
        pagination: {
          page,
          limit,
          total: news.length,
          totalPages: news.length ? 1 : 0,
        },
      });
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }
    return handleApiError(error);
  }
}

async function refreshNewsIfStale() {
  const now = Date.now();
  if (newsRefreshInFlight) {
    await withTimeout(newsRefreshInFlight, 4000);
    return;
  }
  if (now - lastNewsRefreshAttempt < NEWS_REFRESH_COOLDOWN_MS) return;

  const latest = await db.news.findFirst({
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });

  if (latest && now - latest.publishedAt.getTime() < NEWS_STALE_AFTER_MS) return;

  lastNewsRefreshAttempt = now;
  newsRefreshInFlight = ingestNewsFromProviders()
    .catch((error) => {
      console.warn("[news] Live news refresh failed:", error);
    })
    .finally(() => {
      newsRefreshInFlight = null;
    });

  await withTimeout(newsRefreshInFlight, 4000);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

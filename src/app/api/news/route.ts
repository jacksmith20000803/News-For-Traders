import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validations/content";
import { INTEREST_TO_NEWS_SLUGS } from "@/lib/constants";
import { ImportanceLevel, Prisma } from "@prisma/client";
import { z } from "zod";

const newsQuerySchema = paginationSchema.extend({
  importance: z.nativeEnum(ImportanceLevel).optional(),
  coin: z.string().trim().min(1).max(30).optional(),
  search: z.string().trim().max(200).optional(),
  favorites: z.enum(["true", "false"]).optional(),
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
    });

    const user = await getCurrentUser();
    const favoriteOnly = params.favorites === "true";

    if (favoriteOnly && !user) {
      return apiSuccess({
        news: [],
        personalized: null,
        favoriteNewsIds: [],
        pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 0 },
      });
    }

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
    if (favoriteOnly && user) {
      where.bookmarks = { some: { userId: user.id } };
    }

    const [news, total] = await Promise.all([
      db.news.findMany({
        where,
        include: {
          source: { select: { name: true, reliabilityScore: true } },
          category: { select: { name: true, slug: true } },
          assets: { select: { symbol: true, assetType: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { publishedAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.news.count({ where }),
    ]);

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
    if (user) {
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

    return apiSuccess({
      news,
      personalized,
      favoriteNewsIds,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validations/content";
import { INTEREST_TO_NEWS_SLUGS } from "@/lib/constants";
import { ImportanceLevel } from "@prisma/client";
import { z } from "zod";

const newsQuerySchema = paginationSchema.extend({
  importance: z.nativeEnum(ImportanceLevel).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = newsQuerySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      importance: searchParams.get("importance") ?? undefined,
    });

    const user = await getCurrentUser();
    const where = params.importance ? { importance: params.importance } : {};

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
          include: {
            source: { select: { name: true, reliabilityScore: true } },
            category: { select: { name: true, slug: true } },
            assets: { select: { symbol: true, assetType: true } },
            _count: { select: { comments: true } },
          },
          orderBy: { publishedAt: "desc" },
          take: 6,
        });
      }
    }

    return apiSuccess({
      news,
      personalized,
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

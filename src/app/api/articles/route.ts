import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { db } from "@/lib/db";
import { requireVerifiedEmail, validateCsrf } from "@/lib/auth/guards";
import { articleCreateSchema, paginationSchema } from "@/lib/validations/content";
import { PostCategory } from "@prisma/client";
import { slugify } from "@/lib/utils";
import { logUserActivity } from "@/lib/audit";
import { z } from "zod";

const articleQuerySchema = paginationSchema.extend({
  category: z.nativeEnum(PostCategory).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = articleQuerySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      category: searchParams.get("category") ?? undefined,
    });

    const where = {
      status: "PUBLISHED" as const,
      ...(params.category ? { category: params.category } : {}),
    };

    const [articles, total] = await Promise.all([
      db.article.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true, reputation: true } },
          tags: { include: { tag: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.article.count({ where }),
    ]);

    return apiSuccess({
      articles,
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

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireVerifiedEmail();
    const body = await parseJsonBody(request);
    const data = articleCreateSchema.parse(body);

    const slug = `${slugify(data.title)}-${Date.now()}`;

    const article = await db.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          title: data.title,
          slug,
          content: data.content,
          excerpt: data.content.slice(0, 200),
          authorId: user.id,
          category: data.category,
          status: "PENDING",
        },
      });

      if (data.tags?.length) {
        for (const tagName of data.tags) {
          const tagSlug = slugify(tagName);
          const tag = await tx.tag.upsert({
            where: { slug: tagSlug },
            create: { name: tagName, slug: tagSlug },
            update: {},
          });
          await tx.articleTag.create({
            data: { articleId: created.id, tagId: tag.id },
          });
        }
      }

      await tx.user.update({
        where: { id: user.id },
        data: { contributionCount: { increment: 1 } },
      });

      return created;
    });

    await logUserActivity(user.id, "ARTICLE_CREATE", { articleId: article.id });

    return apiSuccess(article, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

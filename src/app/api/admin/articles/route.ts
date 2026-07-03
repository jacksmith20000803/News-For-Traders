import { NextRequest } from "next/server";
import { ContentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(50).default(12),
  q: z.string().trim().optional(),
  status: z.nativeEnum(ContentStatus).optional(),
});

const actionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["approve", "reject", "delete"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const where: Prisma.ArticleWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { content: { contains: params.q, mode: "insensitive" } },
              { author: { name: { contains: params.q, mode: "insensitive" } } },
              { author: { email: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          author: { select: { id: true, name: true, email: true, avatar: true } },
          tags: { include: { tag: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      db.article.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireAdmin();
    const body = actionSchema.parse(await parseJsonBody(request));
    const reason = body.reason?.trim();

    if ((body.action === "reject" || body.action === "delete") && !reason) {
      return apiError("A reason is required.", 400, "REASON_REQUIRED");
    }

    const articles = await db.article.findMany({
      where: { id: { in: body.ids } },
      select: { id: true, title: true, authorId: true },
    });

    const nextStatus =
      body.action === "approve"
        ? ContentStatus.PUBLISHED
        : body.action === "reject"
          ? ContentStatus.REJECTED
          : ContentStatus.ARCHIVED;

    const result = await db.article.updateMany({
      where: { id: { in: articles.map((article) => article.id) } },
      data: {
        status: nextStatus,
        ...(body.action === "approve" ? { publishedAt: new Date() } : {}),
      },
    });

    await Promise.all(
      articles.map((article) =>
        createNotification({
          userId: article.authorId,
          type: "MODERATION",
          title:
            body.action === "approve"
              ? "Your community article was approved"
              : body.action === "reject"
                ? "Your community article was rejected"
                : "Your community article was removed",
          message:
            body.action === "approve"
              ? `"${article.title}" is now visible in the community.`
              : `"${article.title}" was ${body.action === "reject" ? "rejected" : "removed"}. Reason: ${reason}`,
          metadata: { articleId: article.id, action: body.action, reason },
        })
      )
    );

    return apiSuccess({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

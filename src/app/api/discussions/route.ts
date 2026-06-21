import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { db } from "@/lib/db";
import { requireAuth, requireVerifiedEmail, validateCsrf } from "@/lib/auth/guards";
import { discussionCreateSchema, paginationSchema } from "@/lib/validations/content";
import { PostCategory } from "@prisma/client";
import { logUserActivity } from "@/lib/audit";
import { z } from "zod";

const discussionQuerySchema = paginationSchema.extend({
  category: z.nativeEnum(PostCategory).optional(),
  sort: z.enum(["newest", "trending", "top"]).default("newest"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = discussionQuerySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "15",
      category: searchParams.get("category") ?? undefined,
      sort: searchParams.get("sort") ?? "newest",
    });

    const where = params.category ? { category: params.category } : {};

    const orderBy =
      params.sort === "trending"
        ? [{ upvoteCount: "desc" as const }, { createdAt: "desc" as const }]
        : params.sort === "top"
          ? [{ upvoteCount: "desc" as const }]
          : [{ createdAt: "desc" as const }];

    const [discussions, total] = await Promise.all([
      db.discussion.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true, reputation: true } },
          _count: { select: { comments: true } },
        },
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.discussion.count({ where }),
    ]);

    return apiSuccess({
      discussions,
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
    const data = discussionCreateSchema.parse(body);

    const discussion = await db.discussion.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: user.id,
        category: data.category,
      },
    });

    await db.user.update({
      where: { id: user.id },
      data: { contributionCount: { increment: 1 }, reputation: { increment: 2 } },
    });

    await logUserActivity(user.id, "DISCUSSION_CREATE", { discussionId: discussion.id });

    return apiSuccess(discussion, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

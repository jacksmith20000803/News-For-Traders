import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();

    const bookmarks = await db.bookmark.findMany({
      where: { userId: user.id },
      include: {
        news: {
          include: {
            source: { select: { name: true } },
            assets: { select: { symbol: true } },
          },
        },
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(bookmarks);
  } catch (error) {
    return handleApiError(error);
  }
}

const bookmarkSchema = z.object({
  action: z.enum(["add", "remove"]),
  newsId: z.string().cuid().optional(),
  articleId: z.string().cuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = bookmarkSchema.parse(body);

    if (!data.newsId && !data.articleId) {
      return apiError("newsId or articleId is required", 422);
    }

    if (data.action === "add") {
      const bookmark = await db.bookmark.create({
        data: {
          userId: user.id,
          newsId: data.newsId,
          articleId: data.articleId,
        },
      });
      return apiSuccess(bookmark, 201);
    }

    await db.bookmark.deleteMany({
      where: {
        userId: user.id,
        ...(data.newsId ? { newsId: data.newsId } : { articleId: data.articleId }),
      },
    });

    return apiSuccess({ message: "Bookmark removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

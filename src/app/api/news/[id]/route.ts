import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
            author: { select: { id: true, name: true, avatar: true, reputation: true } },
            replies: {
              where: { isRemoved: false },
              include: {
                author: { select: { id: true, name: true, avatar: true, reputation: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!news) {
      return apiSuccess(null);
    }

    return apiSuccess(news);
  } catch (error) {
    return handleApiError(error);
  }
}

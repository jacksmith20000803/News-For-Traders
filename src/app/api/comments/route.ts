import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireVerifiedEmail, validateCsrf } from "@/lib/auth/guards";
import { commentSchema } from "@/lib/validations/content";
import { db } from "@/lib/db";
import { logUserActivity } from "@/lib/audit";
import { notifyDiscussionReply } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    await validateCsrf(request);
    const user = await requireVerifiedEmail();
    const body = await parseJsonBody(request);
    const data = commentSchema.parse(body);

    const { newsId, articleId, discussionId } = body as {
      newsId?: string;
      articleId?: string;
      discussionId?: string;
    };

    const targetCount = [newsId, articleId, discussionId].filter(Boolean).length;
    if (targetCount !== 1) {
      return apiError("Exactly one target (newsId, articleId, or discussionId) is required", 422);
    }

    if (discussionId) {
      const discussion = await db.discussion.findUnique({
        where: { id: discussionId },
        select: { isLocked: true, authorId: true, title: true },
      });
      if (!discussion) return apiError("Discussion not found", 404);
      if (discussion.isLocked) return apiError("Discussion is locked", 403);
    }

    const comment = await db.comment.create({
      data: {
        content: data.content,
        authorId: user.id,
        newsId,
        articleId,
        discussionId,
        parentId: data.parentId,
      },
    });

    if (discussionId && data.parentId) {
      const parent = await db.comment.findUnique({
        where: { id: data.parentId },
        select: { authorId: true },
      });
      if (parent && parent.authorId !== user.id) {
        await notifyDiscussionReply({
          discussionAuthorId: parent.authorId,
          replierId: user.id,
          replierName: user.name,
          discussionId,
          discussionTitle: "",
        });
      }
    } else if (discussionId) {
      const discussion = await db.discussion.findUnique({
        where: { id: discussionId },
        select: { authorId: true, title: true },
      });
      if (discussion && discussion.authorId !== user.id) {
        await notifyDiscussionReply({
          discussionAuthorId: discussion.authorId,
          replierId: user.id,
          replierName: user.name,
          discussionId,
          discussionTitle: discussion.title,
        });
      }
    }

    await logUserActivity(user.id, "COMMENT_CREATE", { commentId: comment.id });

    return apiSuccess(comment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

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

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id } = await params;
    const body = await parseJsonBody(request);
    const { value } = voteSchema.parse(body);

    const discussion = await db.discussion.findUnique({ where: { id } });
    if (!discussion) return apiError("Discussion not found", 404);
    if (discussion.isLocked) return apiError("Discussion is locked", 403);

    const existing = await db.discussionVote.findUnique({
      where: { userId_discussionId: { userId: user.id, discussionId: id } },
    });

    if (value === 0) {
      if (existing) {
        await db.discussionVote.delete({
          where: { userId_discussionId: { userId: user.id, discussionId: id } },
        });
        await db.discussion.update({
          where: { id },
          data: {
            upvoteCount: { decrement: existing.value === 1 ? 1 : 0 },
            downvoteCount: { decrement: existing.value === -1 ? 1 : 0 },
          },
        });
      }
      return apiSuccess({ message: "Vote removed" });
    }

    if (existing) {
      if (existing.value === value) {
        return apiSuccess({ message: "Already voted" });
      }
      await db.discussionVote.update({
        where: { userId_discussionId: { userId: user.id, discussionId: id } },
        data: { value },
      });
      await db.discussion.update({
        where: { id },
        data: {
          upvoteCount: { increment: value === 1 ? 1 : -1 },
          downvoteCount: { increment: value === -1 ? 1 : -1 },
        },
      });
    } else {
      await db.discussionVote.create({
        data: { userId: user.id, discussionId: id, value },
      });
      await db.discussion.update({
        where: { id },
        data: {
          upvoteCount: { increment: value === 1 ? 1 : 0 },
          downvoteCount: { increment: value === -1 ? 1 : 0 },
        },
      });
    }

    const updated = await db.discussion.findUnique({ where: { id } });
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

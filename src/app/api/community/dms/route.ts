import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const createDmSchema = z.object({
  userId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = createDmSchema.parse(await parseJsonBody(request));
    if (data.userId === user.id) throw new ApiError(422, "You cannot DM yourself.", "SELF_DM");

    const otherUser = await db.user.findFirst({
      where: { id: data.userId, deletedAt: null, isBanned: false, isSuspended: false },
      select: { id: true, name: true, username: true, email: true, avatar: true },
    });
    if (!otherUser) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");

    const existing = await db.directConversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: data.userId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true, email: true, avatar: true } } } },
      },
    });

    const conversation =
      existing ??
      (await db.directConversation.create({
        data: {
          participants: {
            create: [{ userId: user.id }, { userId: data.userId }],
          },
        },
        include: {
          participants: { include: { user: { select: { id: true, name: true, username: true, email: true, avatar: true } } } },
        },
      }));

    return apiSuccess({
      conversation: {
        id: conversation.id,
        otherUser,
        updatedAt: conversation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

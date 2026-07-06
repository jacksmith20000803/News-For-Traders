import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const createRequestSchema = z.object({
  recipientId: z.string().cuid(),
});

const DAILY_FRIEND_REQUEST_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = createRequestSchema.parse(await parseJsonBody(request));
    if (data.recipientId === user.id) throw new ApiError(422, "You cannot send a friend request to yourself.", "SELF_REQUEST");

    const recipient = await db.user.findFirst({
      where: { id: data.recipientId, deletedAt: null, isBanned: false, isSuspended: false },
      select: { id: true, name: true },
    });
    if (!recipient) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await db.friendRequest.count({
      where: { requesterId: user.id, createdAt: { gte: since } },
    });
    if (sentToday >= DAILY_FRIEND_REQUEST_LIMIT) {
      throw new ApiError(429, "You can send up to 5 friend requests per day.", "FRIEND_REQUEST_LIMIT");
    }

    const existing = await db.friendRequest.findUnique({
      where: { requesterId_recipientId: { requesterId: user.id, recipientId: data.recipientId } },
    });
    if (existing?.status === "PENDING") {
      return apiSuccess({ request: serializeFriendRequest(existing), limitRemaining: Math.max(0, DAILY_FRIEND_REQUEST_LIMIT - sentToday) });
    }
    if (existing?.status === "ACCEPTED") {
      throw new ApiError(409, "You are already connected.", "FRIEND_ALREADY_ACCEPTED");
    }

    const friendRequest = existing
      ? await db.friendRequest.update({
          where: { id: existing.id },
          data: { status: "PENDING", createdAt: new Date(), respondedAt: null },
        })
      : await db.friendRequest.create({
          data: {
            requesterId: user.id,
            recipientId: data.recipientId,
          },
        });

    await createNotification({
      userId: recipient.id,
      type: "SYSTEM",
      title: "New friend request",
      message: `${user.name} sent you a friend request.`,
      metadata: { friendRequestId: friendRequest.id },
    });

    return apiSuccess({
      request: serializeFriendRequest(friendRequest),
      limitRemaining: Math.max(0, DAILY_FRIEND_REQUEST_LIMIT - sentToday - 1),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function serializeFriendRequest(request: {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
}) {
  return {
    id: request.id,
    requesterId: request.requesterId,
    recipientId: request.recipientId,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() ?? null,
  };
}

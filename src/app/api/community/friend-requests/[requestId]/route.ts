import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const actionSchema = z.object({
  action: z.enum(["accept", "ignore"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { requestId } = await params;
    const data = actionSchema.parse(await parseJsonBody(request));

    const friendRequest = await db.friendRequest.findFirst({
      where: { id: requestId, recipientId: user.id, status: "PENDING" },
      include: {
        requester: { select: { id: true, name: true, username: true, email: true, avatar: true } },
      },
    });
    if (!friendRequest) throw new ApiError(404, "Friend request not found.", "FRIEND_REQUEST_NOT_FOUND");

    const updated = await db.friendRequest.update({
      where: { id: friendRequest.id },
      data: {
        status: data.action === "accept" ? "ACCEPTED" : "IGNORED",
        respondedAt: new Date(),
      },
    });

    if (data.action === "accept") {
      await createNotification({
        userId: friendRequest.requesterId,
        type: "SYSTEM",
        title: "Friend request accepted",
        message: `${user.name} accepted your friend request.`,
        metadata: { friendRequestId: friendRequest.id },
      });
    }

    return apiSuccess({
      request: {
        id: updated.id,
        status: updated.status,
        requester: friendRequest.requester,
        respondedAt: updated.respondedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

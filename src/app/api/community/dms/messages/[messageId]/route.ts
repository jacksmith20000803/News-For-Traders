import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const updateSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { messageId } = await params;
    const data = updateSchema.parse(await parseJsonBody(request));

    const message = await db.directMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) throw new ApiError(404, "Message not found.", "MESSAGE_NOT_FOUND");
    if (message.senderId !== user.id) {
      throw new ApiError(403, "You can only edit your own messages.", "MESSAGE_EDIT_FORBIDDEN");
    }

    const updated = await db.directMessage.update({
      where: { id: messageId },
      data: { content: data.content, editedAt: new Date() },
    });

    return apiSuccess({
      message: {
        id: updated.id,
        content: updated.content,
        editedAt: updated.editedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { messageId } = await params;

    const message = await db.directMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) throw new ApiError(404, "Message not found.", "MESSAGE_NOT_FOUND");
    if (message.senderId !== user.id) {
      throw new ApiError(403, "You can only delete your own messages.", "MESSAGE_DELETE_FORBIDDEN");
    }

    await db.directMessage.update({
      where: { id: messageId },
      data: {
        content: null,
        attachmentUrl: null,
        attachmentName: null,
        attachmentType: null,
        attachmentSize: null,
        deletedAt: new Date(),
      },
    });

    return apiSuccess({ deleted: true, id: messageId });
  } catch (error) {
    return handleApiError(error);
  }
}

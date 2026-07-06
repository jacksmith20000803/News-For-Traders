import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { saveChatAttachment } from "@/lib/community/uploads";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events/broadcaster";

const messageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  replyToId: z.string().cuid().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    await requireConversationParticipant(conversationId, user.id);

    const messages = await db.directMessage.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true, username: true, avatar: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    return apiSuccess({
      messages: messages.reverse().map(serializeDirectMessage),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { conversationId } = await params;
    const participants = await requireConversationParticipant(conversationId, user.id);

    const formData = await request.formData();
    const data = messageSchema.parse({
      content: String(formData.get("content") ?? "") || undefined,
      replyToId: String(formData.get("replyToId") ?? "") || undefined,
    });
    const attachment = formData.get("attachment");
    const savedAttachment = attachment instanceof File && attachment.size > 0 ? await saveChatAttachment(attachment) : null;

    if (!data.content && !savedAttachment) {
      throw new ApiError(422, "Message text or attachment is required.", "MESSAGE_REQUIRED");
    }

    if (data.replyToId) {
      const replyTarget = await db.directMessage.findFirst({
        where: { id: data.replyToId, conversationId },
        select: { id: true },
      });
      if (!replyTarget) throw new ApiError(404, "Reply target not found.", "REPLY_NOT_FOUND");
    }

    const message = await db.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          content: data.content,
          replyToId: data.replyToId,
          attachmentUrl: savedAttachment?.url,
          attachmentName: savedAttachment?.name,
          attachmentType: savedAttachment?.type,
          attachmentSize: savedAttachment?.size,
        },
        include: {
          sender: { select: { id: true, name: true, username: true, avatar: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true, username: true, avatar: true } },
            },
          },
        },
      });

      await tx.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    const serialized = serializeDirectMessage(message);
    participants
      .filter((participant) => participant.userId !== user.id)
      .forEach((participant) => {
        eventBus.publish("chat", { type: "dm.message", conversationId, message: serialized }, participant.userId);
      });

    return apiSuccess({ message: serialized }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

async function requireConversationParticipant(conversationId: string, userId: string) {
  const conversation = await db.directConversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: {
      participants: { select: { userId: true } },
    },
  });
  if (!conversation) throw new ApiError(403, "Conversation access required.", "DM_ACCESS_REQUIRED");
  return conversation.participants;
}

function serializeDirectMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  replyToId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender: { id: string; name: string; username: string | null; avatar: string | null };
  replyTo:
    | ({
        sender: { id: string; name: string; username: string | null; avatar: string | null };
      } & {
        id: string;
        content: string | null;
        attachmentName: string | null;
        deletedAt: Date | null;
      })
    | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.deletedAt ? "" : message.content,
    attachmentUrl: message.deletedAt ? null : message.attachmentUrl,
    attachmentName: message.deletedAt ? null : message.attachmentName,
    attachmentType: message.deletedAt ? null : message.attachmentType,
    attachmentSize: message.deletedAt ? null : message.attachmentSize,
    replyToId: message.replyToId,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.deletedAt ? "" : message.replyTo.content,
          attachmentName: message.replyTo.deletedAt ? null : message.replyTo.attachmentName,
          deletedAt: message.replyTo.deletedAt?.toISOString() ?? null,
          sender: message.replyTo.sender,
        }
      : null,
  };
}

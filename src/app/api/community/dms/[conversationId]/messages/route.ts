import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { getCommunityMediaItem } from "@/lib/community/media";
import { saveChatAttachment } from "@/lib/community/uploads";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events/broadcaster";

const messageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  replyToId: z.string().cuid().optional(),
  mediaId: z.string().trim().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    const participants = await requireConversationParticipant(conversationId, user.id);

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

    const readAt = new Date();
    await db.directConversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: readAt },
    });

    participants
      .filter((participant) => participant.userId !== user.id)
      .forEach((participant) => {
        eventBus.publish("chat", { type: "dm.read", conversationId, readerId: user.id, readAt: readAt.toISOString() }, participant.userId);
      });

    return apiSuccess({
      messages: messages.reverse().map((message) => serializeDirectMessage(message, user.id, participants)),
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
      mediaId: String(formData.get("mediaId") ?? "") || undefined,
    });
    const attachment = formData.get("attachment");
    const savedAttachment = attachment instanceof File && attachment.size > 0 ? await saveChatAttachment(attachment) : null;
    const catalogMedia = data.mediaId ? await getCommunityMediaItem(data.mediaId) : null;

    if (data.mediaId && (!catalogMedia || catalogMedia.type === "EMOJI" || !catalogMedia.url)) {
      throw new ApiError(422, "Selected media is no longer available.", "MEDIA_NOT_FOUND");
    }

    if (!data.content && !savedAttachment && !catalogMedia) {
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
          attachmentUrl: savedAttachment?.url ?? catalogMedia?.url,
          attachmentName: savedAttachment?.name ?? catalogMedia?.name,
          attachmentType: savedAttachment?.type ?? (catalogMedia ? (catalogMedia.type === "GIF" ? "image/gif" : "image/webp") : undefined),
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

    const serialized = serializeDirectMessage(message, user.id, participants);
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { conversationId } = await params;
    const participants = await requireConversationParticipant(conversationId, user.id);
    const readAt = new Date();

    await db.directConversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: readAt },
    });

    participants
      .filter((participant) => participant.userId !== user.id)
      .forEach((participant) => {
        eventBus.publish("chat", { type: "dm.read", conversationId, readerId: user.id, readAt: readAt.toISOString() }, participant.userId);
      });

    return apiSuccess({ readAt: readAt.toISOString() });
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
      participants: { select: { userId: true, lastReadAt: true } },
    },
  });
  if (!conversation) throw new ApiError(403, "Conversation access required.", "DM_ACCESS_REQUIRED");
  return conversation.participants;
}

type ConversationParticipantReadState = {
  userId: string;
  lastReadAt: Date | null;
};

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
}, currentUserId?: string, participants: ConversationParticipantReadState[] = []) {
  const recipientViewedAt =
    currentUserId === message.senderId
      ? participants
          .filter((participant) => participant.userId !== message.senderId)
          .map((participant) => participant.lastReadAt)
          .filter((lastReadAt): lastReadAt is Date => lastReadAt !== null && lastReadAt.getTime() >= message.createdAt.getTime())
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
      : null;

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
    viewedAt: recipientViewedAt?.toISOString() ?? null,
    viewedByRecipient: Boolean(recipientViewedAt),
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

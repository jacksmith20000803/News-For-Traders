import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { saveChatAttachment } from "@/lib/community/uploads";
import { eventBus } from "@/lib/events/broadcaster";

const messageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  replyToId: z.string().cuid().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const user = await requireAuth();
    const { communityId } = await params;
    await requireCommunityMember(communityId, user.id);

    const messages = await db.communityMessage.findMany({
      where: { communityId },
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
      messages: messages.reverse().map(serializeCommunityMessage),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { communityId } = await params;
    await requireCommunityMember(communityId, user.id, { requireWritable: true });

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
      const replyTarget = await db.communityMessage.findFirst({
        where: { id: data.replyToId, communityId },
        select: { id: true },
      });
      if (!replyTarget) throw new ApiError(404, "Reply target not found.", "REPLY_NOT_FOUND");
    }

    const message = await db.communityMessage.create({
      data: {
        communityId,
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

    eventBus.publish("chat", { type: "community.message", communityId, message: serializeCommunityMessage(message) });
    return apiSuccess({ message: serializeCommunityMessage(message) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

async function requireCommunityMember(
  communityId: string,
  userId: string,
  options: { requireWritable?: boolean } = {}
) {
  const membership = await db.communityMembership.findFirst({
    where: {
      communityId,
      userId,
      status: { in: ["ACTIVE", "BLOCKED"] },
      community: { status: "APPROVED", deletedAt: null },
    },
  });

  if (!membership?.rulesAgreedAt) {
    throw new ApiError(403, "Agree to the community rules before entering.", "RULES_REQUIRED");
  }
  if (options.requireWritable && membership.status === "BLOCKED") {
    throw new ApiError(403, "You are blocked from sending messages in this community.", "COMMUNITY_MUTED");
  }

  return membership;
}

function serializeCommunityMessage(message: {
  id: string;
  communityId: string;
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
  updatedAt: Date;
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
    communityId: message.communityId,
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

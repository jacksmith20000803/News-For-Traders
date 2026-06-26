import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events/broadcaster";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();

    let conversation = await db.supportConversation.findFirst({
      where: { userId: user.id, isOpen: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      const settings = await db.chatSettings.findFirst();
      conversation = await db.supportConversation.create({
        data: { userId: user.id },
      });
      if (settings) {
        await db.supportMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: user.id,
            isAdmin: true,
            content: settings.welcomeMessage,
          },
        });
      }
    }

    const messages = await db.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const adminOnline = await db.adminPresence.count({
      where: { status: "ONLINE" },
    });

    return apiSuccess({
      conversation,
      messages,
      adminOnline: adminOnline > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
  conversationId: z.string().cuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = messageSchema.parse(await parseJsonBody(request));

    let conversationId = data.conversationId;
    if (!conversationId) {
      const conv = await db.supportConversation.create({ data: { userId: user.id } });
      conversationId = conv.id;
    }

    const message = await db.supportMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        isAdmin: false,
        content: data.content,
      },
    });

    eventBus.publish("chat", { ...message, conversationId }, user.id);

    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "SUPPORT_MESSAGE",
          title: "New support message",
          message: data.content.slice(0, 100),
          metadata: { conversationId, messageId: message.id },
        })
      )
    );

    return apiSuccess({ message, conversationId });
  } catch (error) {
    return handleApiError(error);
  }
}

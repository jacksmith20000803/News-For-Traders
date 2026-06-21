import { db } from "@/lib/db";
import { eventBus } from "@/lib/events/broadcaster";
import type { NotificationType, Prisma } from "@prisma/client";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const notification = await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  eventBus.publish(
    "notification",
    { type: "notification.created", notification },
    params.userId
  );

  return notification;
}

export async function notifyDiscussionReply(params: {
  discussionAuthorId: string;
  replierId: string;
  replierName: string;
  discussionId: string;
  discussionTitle: string;
}) {
  if (params.discussionAuthorId === params.replierId) return;

  return createNotification({
    userId: params.discussionAuthorId,
    type: "REPLY",
    title: "New reply on your discussion",
    message: `${params.replierName} replied to "${params.discussionTitle}"`,
    metadata: { discussionId: params.discussionId },
  });
}

export async function notifyBreakingNews(params: {
  userIds: string[];
  headline: string;
  newsId: string;
}) {
  await Promise.all(
    params.userIds.map((userId) =>
      createNotification({
        userId,
        type: "NEWS_ALERT",
        title: "Breaking news",
        message: params.headline,
        metadata: { newsId: params.newsId },
      })
    )
  );
}

export async function notifyModerationAction(params: {
  userId: string;
  title: string;
  message: string;
}) {
  return createNotification({
    userId: params.userId,
    type: "MODERATION",
    title: params.title,
    message: params.message,
  });
}

export async function notifySystemAnnouncement(params: {
  userIds: string[];
  title: string;
  message: string;
}) {
  await Promise.all(
    params.userIds.map((userId) =>
      createNotification({
        userId,
        type: "SYSTEM",
        title: params.title,
        message: params.message,
      })
    )
  );
}

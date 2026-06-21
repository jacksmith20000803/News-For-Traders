import { db } from "@/lib/db";
import type { AuditAction, Prisma } from "@prisma/client";

export async function logAuditEvent(params: {
  adminId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  return db.auditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ?? undefined,
      ipAddress: params.ipAddress,
    },
  });
}

export async function logUserActivity(
  userId: string,
  action: string,
  metadata?: Prisma.InputJsonValue
) {
  return db.userActivity.create({
    data: {
      userId,
      action,
      metadata: metadata ?? undefined,
    },
  });
}

export async function createNotification(params: {
  userId: string;
  type: "REPLY" | "MENTION" | "NEWS_ALERT" | "SYSTEM" | "MODERATION" | "UPVOTE";
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return db.notification.create({ data: params });
}

import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: {
          userId: user.id,
          ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    return apiSuccess({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

const markSchema = z.object({
  action: z.enum(["mark_read", "mark_all_read"]),
  notificationId: z.string().cuid().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = markSchema.parse(body);

    if (data.action === "mark_all_read") {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return apiSuccess({ message: "All notifications marked as read" });
    }

    if (!data.notificationId) {
      return apiError("notificationId is required", 422);
    }

    const notification = await db.notification.updateMany({
      where: { id: data.notificationId, userId: user.id },
      data: { read: true },
    });

    if (notification.count === 0) {
      return apiError("Notification not found", 404);
    }

    return apiSuccess({ message: "Notification marked as read" });
  } catch (error) {
    return handleApiError(error);
  }
}

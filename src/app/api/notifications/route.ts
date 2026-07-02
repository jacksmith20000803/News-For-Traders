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
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20), 50);
    const where = {
      userId: user.id,
      ...(unreadOnly ? { read: false } : {}),
      NOT: { title: "Market Data Updated" },
    };

    const [notifications, unreadCount, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where: { ...where, read: false } }),
      db.notification.count({ where }),
    ]);

    return apiSuccess({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
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

const deleteSchema = z.object({
  ids: z.array(z.string().cuid()).optional(),
  all: z.boolean().optional(),
});

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = deleteSchema.parse(await parseJsonBody(request));

    if (data.all) {
      const result = await db.notification.deleteMany({
        where: {
          userId: user.id,
          NOT: { title: "Market Data Updated" },
        },
      });
      return apiSuccess({ deleted: result.count });
    }

    const ids = data.ids ?? [];
    if (!ids.length) {
      return apiError("Select at least one notification to delete", 422);
    }

    const result = await db.notification.deleteMany({
      where: { userId: user.id, id: { in: ids } },
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

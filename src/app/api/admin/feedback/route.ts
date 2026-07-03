import { NextRequest } from "next/server";
import { FeedbackStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { logAuditEvent } from "@/lib/audit";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(50).default(12),
  q: z.string().trim().optional(),
  status: z.nativeEnum(FeedbackStatus).optional(),
});

const replySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  reply: z.string().trim().min(1).max(4000),
});

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const where: Prisma.FeedbackSubmissionWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { email: { contains: params.q, mode: "insensitive" } },
              { subject: { contains: params.q, mode: "insensitive" } },
              { message: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.feedbackSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { user: { select: { id: true, name: true, email: true, avatar: true, username: true } } },
      }),
      db.feedbackSubmission.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = replySchema.parse(await parseJsonBody(request));

    const submissions = await db.feedbackSubmission.findMany({
      where: { id: { in: body.ids } },
      select: { id: true, userId: true, subject: true, email: true },
    });

    if (!submissions.length) return apiError("Feedback item not found", 404, "FEEDBACK_NOT_FOUND");

    const result = await db.feedbackSubmission.updateMany({
      where: { id: { in: submissions.map((submission) => submission.id) } },
      data: {
        adminReply: body.reply,
        status: "REPLIED",
        repliedAt: new Date(),
      },
    });

    await Promise.allSettled(
      submissions
        .filter((submission) => submission.userId)
        .map((submission) =>
          createNotification({
            userId: submission.userId!,
            type: "ADMIN_MESSAGE",
            title: "Admin replied to your feedback",
            message: `Feedback: ${submission.subject}. Reply: ${body.reply}`,
            metadata: { feedbackId: submission.id },
          })
        )
    );

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "feedback",
      targetId: submissions.map((submission) => submission.id).join(","),
      metadata: { action: "feedback_reply", ids: body.ids, reply: body.reply },
    });

    return apiSuccess({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = deleteSchema.parse(await parseJsonBody(request));

    const result = await db.feedbackSubmission.deleteMany({
      where: { id: { in: body.ids } },
    });

    await logAuditEvent({
      adminId: admin.id,
      action: "CONTENT_DELETE",
      targetType: "feedback",
      targetId: body.ids.join(","),
      metadata: { action: "feedback_delete", ids: body.ids },
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

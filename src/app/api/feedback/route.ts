import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

const feedbackSchema = z.object({
  type: z.enum(["CONTACT", "FEEDBACK", "BUG", "SUGGESTION"]).default("CONTACT"),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await parseJsonBody(request);
    const data = feedbackSchema.parse(body);

    const submission = await db.feedbackSubmission.create({
      data: { ...data, userId: user?.id },
    });

    const admins = await db.user.findMany({
      where: { role: "ADMIN", deletedAt: null, isSuspended: false, isBanned: false },
      select: { id: true },
    });

    await Promise.allSettled(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "ADMIN_MESSAGE",
          title: "New feedback received",
          message: `${data.name} submitted: ${data.subject}`,
          metadata: { feedbackId: submission.id },
        })
      )
    );

    return apiSuccess(submission, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

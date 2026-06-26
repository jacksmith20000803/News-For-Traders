import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
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

    return apiSuccess(submission, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

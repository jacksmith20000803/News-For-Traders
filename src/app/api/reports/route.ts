import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { reportSchema } from "@/lib/validations/content";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = reportSchema.parse(body);

    const report = await db.report.create({
      data: {
        reporterId: user.id,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        description: data.description,
      },
    });

    return apiSuccess(report, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

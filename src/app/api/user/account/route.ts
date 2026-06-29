import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const accountActionSchema = z.object({
  action: z.literal("disable"),
});

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    accountActionSchema.parse(body);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { isSuspended: true },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.trustedDevice.deleteMany({ where: { userId: user.id } }),
    ]);

    await destroySession();

    return apiSuccess({ message: "Account disabled" });
  } catch (error) {
    return handleApiError(error);
  }
}

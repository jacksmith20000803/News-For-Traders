import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth/admin-guard";
import { validateCsrf } from "@/lib/auth/guards";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdminApi();

    const body = await request.json();
    const { imageUrl } = body as { imageUrl?: string };

    if (typeof imageUrl !== "string") {
      return apiError("Invalid image URL", 400);
    }

    await db.siteSetting.upsert({
      where: { key: "platform_background_image" },
      update: { value: imageUrl },
      create: { key: "platform_background_image", value: imageUrl },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "SETTINGS_UPDATE",
        ipAddress: getClientIp(request),
        metadata: { setting: "platform_background_image", value: imageUrl },
      },
    });

    return apiSuccess({ message: "Background image updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

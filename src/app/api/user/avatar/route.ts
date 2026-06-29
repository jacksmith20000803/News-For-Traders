import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return apiError("Avatar image is required", 400, "AVATAR_REQUIRED");
    }

    if (!file.type.startsWith("image/")) {
      return apiError("Avatar must be an image file", 422, "INVALID_AVATAR_TYPE");
    }

    if (file.size > 2 * 1024 * 1024) {
      return apiError("Avatar must be smaller than 2MB", 422, "AVATAR_TOO_LARGE");
    }

    const extension = getExtension(file.type);
    const fileName = `${user.id}-${randomUUID()}${extension}`;
    const publicDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(publicDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(publicDir, fileName), Buffer.from(bytes));

    const avatarUrl = `/uploads/avatars/${fileName}`;
    await db.user.update({
      where: { id: user.id },
      data: { avatar: avatarUrl },
    });

    return apiSuccess({ avatar: avatarUrl });
  } catch (error) {
    return handleApiError(error);
  }
}

function getExtension(contentType: string) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  return ".jpg";
}

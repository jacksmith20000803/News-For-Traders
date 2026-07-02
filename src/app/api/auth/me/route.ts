import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCurrentUser,
  getCurrentSessionPayload,
  toSafeUser,
  getCsrfTokenFromCookie,
  setCsrfCookie,
  clearSessionCookie,
} from "@/lib/auth/session";
import { createSignedCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();

    const existingCsrfToken = await getCsrfTokenFromCookie();
    const hasValidCsrf = existingCsrfToken && verifyCsrfToken(existingCsrfToken);
    const csrfToken = hasValidCsrf ? existingCsrfToken : createSignedCsrfToken();
    if (!hasValidCsrf) {
      await setCsrfCookie(csrfToken);
    }
    const response = apiSuccess({
      user: user ? toSafeUser(user) : null,
      reason: user ? null : await readInactiveAccountReason(),
      csrfToken,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

async function readInactiveAccountReason() {
  const payload = await getCurrentSessionPayload();
  if (!payload?.userId) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { deletedAt: true, isBanned: true, isSuspended: true },
  });

  if (user?.deletedAt || user?.isBanned) {
    await clearSessionCookie();
    return "account_deleted";
  }

  if (user?.isSuspended) return "account_suspended";
  return null;
}

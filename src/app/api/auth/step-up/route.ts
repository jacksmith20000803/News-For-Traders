import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import {
  createSessionToken,
  getCurrentSessionPayload,
  setSessionCookie,
} from "@/lib/auth/session";
import { logUserActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import { decryptTotpSecret, TOTP_VALID_WINDOW } from "@/lib/security/mfa";
import { getClientIp } from "@/lib/security/rate-limit";
import { verifyTotpCode } from "@/lib/security/totp";

const stepUpSchema = z.object({
  token: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit authenticator code"),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const currentUser = await requireAuth();
    const data = stepUpSchema.parse(await parseJsonBody(request));
    const ip = getClientIp(request);

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return apiError("Two-factor authentication is not enabled", 400, "MFA_NOT_ENABLED");
    }

    if (!verifyTotpCode(decryptTotpSecret(user.twoFactorSecret), data.token, TOTP_VALID_WINDOW)) {
      await logUserActivity(user.id, "MFA_STEP_UP_FAILURE", { ip });
      return apiError("Invalid two-factor code", 401, "INVALID_TOKEN");
    }

    const payload = await getCurrentSessionPayload();
    if (!payload?.sessionId) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    const authTime = Math.floor(Date.now() / 1000);
    const sessionJwt = await createSessionToken({
      userId: user.id,
      sessionId: payload.sessionId,
      mfaVerified: true,
      authTime,
    });
    await setSessionCookie(sessionJwt);

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorLastVerifiedAt: new Date() },
    });
    await logUserActivity(user.id, "MFA_STEP_UP_SUCCESS", { ip });

    return apiSuccess({ message: "Fresh two-factor verification complete", authTime });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { createUserSession, setCsrfCookie, toSafeUser } from "@/lib/auth/session";
import { logUserActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/rate-limit";
import {
  MFA_TRUST_COOKIE,
  verifyMfaRecoveryToken,
} from "@/lib/security/mfa";

const resetMfaSchema = z.object({
  recoveryToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const data = resetMfaSchema.parse(await parseJsonBody(request));
    const recovery = await verifyMfaRecoveryToken(data.recoveryToken);

    if (!recovery) {
      return apiError("Invalid or expired recovery token", 401, "INVALID_RECOVERY_TOKEN");
    }

    const user = await db.user.findUnique({ where: { id: recovery.userId } });
    if (!user || user.deletedAt || user.isBanned || user.isSuspended) {
      return apiError("Invalid recovery token", 401, "INVALID_RECOVERY_TOKEN");
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecoveryCodes: null,
          twoFactorLastVerifiedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      db.trustedDevice.deleteMany({ where: { userId: user.id } }),
    ]);

    await createUserSession(
      user.id,
      ip,
      request.headers.get("user-agent") ?? undefined,
      {
        mfaVerified: false,
        authTime: Math.floor(Date.now() / 1000),
        emailVerified: Boolean(user.emailVerified),
      }
    );

    const csrfToken = createSignedCsrfToken();
    await setCsrfCookie(csrfToken);
    await logUserActivity(user.id, "MFA_RESET", { ip, critical: true });

    const response = apiSuccess({
      user: toSafeUser({ ...user, twoFactorEnabled: false }),
      csrfToken,
      message: "Two-factor authentication has been disabled. Please re-enable it from Profile Security.",
    });
    response.cookies.delete(MFA_TRUST_COOKIE);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

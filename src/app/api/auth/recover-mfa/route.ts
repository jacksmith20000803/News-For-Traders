import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { logUserActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  consumeRecoveryCode,
  createMfaRecoveryToken,
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_LOCKOUT_HOURS,
} from "@/lib/security/mfa";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const recoverMfaSchema = z.object({
  email: z.string().email(),
  recoveryCode: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const data = recoverMfaSchema.parse(await parseJsonBody(request));
    const email = data.email.toLowerCase();
    const rateLimit = checkRateLimit(
      `mfa-recovery:${email}:${ip}`,
      MAX_RECOVERY_ATTEMPTS,
      RECOVERY_LOCKOUT_HOURS * 60 * 60 * 1000
    );

    if (!rateLimit.success) {
      return apiError("Recovery is temporarily locked. Try again later.", 429, "RECOVERY_LOCKED");
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: true,
        deletedAt: true,
        isBanned: true,
        isSuspended: true,
      },
    });

    if (!user || user.deletedAt || user.isBanned || user.isSuspended) {
      return apiError("Invalid email or recovery code", 400, "INVALID_RECOVERY_CODE");
    }

    if (!user.twoFactorEnabled) {
      return apiError("Two-factor authentication is not enabled", 400, "MFA_NOT_ENABLED");
    }

    const result = await consumeRecoveryCode(user.twoFactorRecoveryCodes, data.recoveryCode);
    if (!result.matched) {
      await logUserActivity(user.id, "MFA_RECOVERY_FAILURE", { ip });
      return apiError("Invalid recovery code", 400, "INVALID_RECOVERY_CODE");
    }

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorRecoveryCodes: result.nextCodes },
    });

    const recoveryToken = await createMfaRecoveryToken(user.id);
    await logUserActivity(user.id, "MFA_RECOVERY_CODE_USED", { ip });

    return apiSuccess({ recoveryToken });
  } catch (error) {
    return handleApiError(error);
  }
}

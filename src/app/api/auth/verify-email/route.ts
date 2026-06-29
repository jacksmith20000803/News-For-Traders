import { z } from "zod";
import { apiSuccess, apiError, handleApiError, parseJsonBody } from "@/lib/api/response";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security/tokens";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import {
  createSessionToken,
  getCurrentSessionPayload,
  setSessionCookie,
} from "@/lib/auth/session";
import { verifyCodeHash } from "@/lib/verification/code-generator";
import { clearRateLimits } from "@/lib/verification/rate-limiter";
import {
  MAX_VERIFICATION_ATTEMPTS,
  VERIFICATION_CODE_LENGTH,
} from "@/lib/verification/constants";

const verifyCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, `Enter a ${VERIFICATION_CODE_LENGTH}-digit verification code`),
});

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `verify:${ip}`,
      config.rateLimit.authMaxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return apiError("Verification token required", 400);
    }

    const verification = await db.emailVerificationToken.findFirst({
      where: { token: hashToken(token), expiresAt: { gt: new Date() } },
    });

    if (!verification) {
      return apiError("Invalid or expired verification token", 400);
    }

    await db.$transaction([
      db.user.update({
        where: { id: verification.userId },
        data: { emailVerified: new Date() },
      }),
      db.emailVerificationToken.delete({ where: { id: verification.id } }),
    ]);

    return apiSuccess({ message: "Email verified successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();

    if (user.emailVerified) {
      return apiSuccess({ message: "Email already verified" });
    }

    const { code } = verifyCodeSchema.parse(await parseJsonBody(request));
    const verification = await db.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return apiError("No verification code is active. Request a new code.", 400, "VERIFICATION_CODE_MISSING");
    }

    if (verification.expiresAt <= new Date()) {
      await db.emailVerificationToken.delete({ where: { id: verification.id } }).catch(() => {});
      return apiError("Verification code expired. Request a new code.", 400, "VERIFICATION_CODE_EXPIRED");
    }

    if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await db.emailVerificationToken.delete({ where: { id: verification.id } }).catch(() => {});
      return apiError("Too many incorrect attempts. Request a new code.", 429, "VERIFICATION_ATTEMPTS_EXCEEDED");
    }

    const valid = await verifyCodeHash(code, verification.token);
    if (!valid) {
      const attempts = verification.attempts + 1;
      if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await db.emailVerificationToken.delete({ where: { id: verification.id } });
        return apiError("Too many incorrect attempts. Request a new code.", 429, "VERIFICATION_ATTEMPTS_EXCEEDED");
      }

      await db.emailVerificationToken.update({
        where: { id: verification.id },
        data: { attempts },
      });

      const attemptsRemaining = MAX_VERIFICATION_ATTEMPTS - attempts;
      return apiError(
        `Incorrect verification code. ${attemptsRemaining} attempts remaining.`,
        400,
        "VERIFICATION_CODE_INVALID"
      );
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      db.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    ]);

    const payload = await getCurrentSessionPayload();
    if (payload) {
      await setSessionCookie(await createSessionToken({ ...payload, emailVerified: true }));
    }
    clearRateLimits(user.id);

    return apiSuccess({
      message: "Email verified successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

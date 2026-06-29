import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/security/csrf";
import { hashToken } from "@/lib/security/tokens";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";

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
    const { requireAuth, validateCsrf } = await import("@/lib/auth/guards");
    await validateCsrf(request);
    const user = await requireAuth();

    if (user.emailVerified) {
      return apiSuccess({ message: "Email already verified" });
    }

    const token = generateToken();
    await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verificationUrl = new URL(`/verify-email?token=${encodeURIComponent(token)}`, request.url).toString();

    return apiSuccess({
      message: "Verification link generated",
      verificationUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

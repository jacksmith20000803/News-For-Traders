import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validations/auth";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/security/csrf";
import { hashToken } from "@/lib/security/tokens";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import {
  destroyOtherSessions,
  getCurrentSessionId,
} from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `forgot:${ip}`,
      config.rateLimit.authMaxRequests,
      config.rateLimit.windowMs
    );

    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    const body = await parseJsonBody(request);
    const data = forgotPasswordSchema.parse(body);

    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (user) {
      const token = generateToken();
      await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    }

    return apiSuccess({
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `reset:${ip}`,
      config.rateLimit.authMaxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    const body = await parseJsonBody(request);
    const data = resetPasswordSchema.parse(body);

    const tokenHash = hashToken(data.token);
    const resetToken = await db.passwordResetToken.findFirst({
      where: { token: tokenHash, expiresAt: { gt: new Date() } },
    });

    if (!resetToken) {
      return apiError("Invalid or expired reset token", 400);
    }

    const passwordHash = await hashPassword(data.password);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      db.passwordResetToken.delete({ where: { id: resetToken.id } }),
      db.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    return apiSuccess({ message: "Password reset successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = changePasswordSchema.parse(body);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.passwordHash) {
      return apiError("Password change not available for OAuth accounts", 400);
    }

    const valid = await verifyPassword(data.currentPassword, dbUser.passwordHash);
    if (!valid) {
      return apiError("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(data.newPassword);

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    ]);

    const sessionId = await getCurrentSessionId();
    if (sessionId) {
      await destroyOtherSessions(user.id, sessionId);
    }

    return apiSuccess({ message: "Password changed successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

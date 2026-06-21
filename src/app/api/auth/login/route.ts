import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/security/password";
import { db } from "@/lib/db";
import {
  createUserSession,
  setCsrfCookie,
  toSafeUser,
} from "@/lib/auth/session";
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { logUserActivity } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `login:${ip}`,
      config.rateLimit.authMaxRequests,
      config.rateLimit.windowMs
    );

    if (!rateLimit.success) {
      return apiError("Too many login attempts. Please try again later.", 429);
    }

    const body = await parseJsonBody(request);
    const data = loginSchema.parse(body);

    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });

    if (!user || !user.passwordHash) {
      return apiError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (user.isBanned) {
      return apiError("Your account has been banned", 403, "ACCOUNT_BANNED");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return apiError(
        `Account temporarily locked. Try again in ${minutes} minutes.`,
        423,
        "ACCOUNT_LOCKED"
      );
    }

    const valid = await verifyPassword(data.password, user.passwordHash);

    if (!valid) {
      const updated = await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });

      if (updated.failedLoginAttempts >= config.security.maxLoginAttempts) {
        await db.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + config.security.lockoutDurationMs),
          },
        });
      }

      return apiError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (user.isSuspended) {
      return apiError("Your account has been suspended", 403, "ACCOUNT_SUSPENDED");
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await createUserSession(
      user.id,
      ip,
      request.headers.get("user-agent") ?? undefined
    );

    const csrfToken = createSignedCsrfToken();
    await setCsrfCookie(csrfToken);

    await logUserActivity(user.id, "LOGIN", { ip });

    return apiSuccess({ user: toSafeUser(user), csrfToken });
  } catch (error) {
    return handleApiError(error);
  }
}

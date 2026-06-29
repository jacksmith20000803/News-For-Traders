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
import { verifyTotpCode } from "@/lib/security/totp";
import {
  createMfaChallengeToken,
  decryptTotpSecret,
  generateTrustedDeviceToken,
  getDeviceName,
  hashTrustedDeviceToken,
  MFA_TRUST_COOKIE,
  mfaTrustCookieMaxAge,
  trustedDeviceExpiresAt,
  TOTP_VALID_WINDOW,
} from "@/lib/security/mfa";
import { isDatabaseConnectivityError } from "@/lib/db-errors";

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

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        return apiError("Two-factor setup is incomplete. Contact support.", 409, "MFA_SECRET_MISSING");
      }

      const trustedToken = request.cookies.get(MFA_TRUST_COOKIE)?.value;
      if (trustedToken) {
        const trustedDevice = await db.trustedDevice.findFirst({
          where: {
            userId: user.id,
            tokenHash: hashTrustedDeviceToken(trustedToken),
            expiresAt: { gt: new Date() },
          },
        });

        if (trustedDevice) {
          await db.trustedDevice.update({
            where: { id: trustedDevice.id },
            data: { expiresAt: trustedDeviceExpiresAt() },
          });

          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              twoFactorLastVerifiedAt: new Date(),
            },
          });

          await createUserSession(
            user.id,
            ip,
            request.headers.get("user-agent") ?? undefined,
            {
              mfaVerified: true,
              authTime: Math.floor(Date.now() / 1000),
              emailVerified: Boolean(user.emailVerified),
            }
          );

          const csrfToken = createSignedCsrfToken();
          await setCsrfCookie(csrfToken);
          await logUserActivity(user.id, "LOGIN_TRUSTED_DEVICE", { ip, trustedDeviceId: trustedDevice.id });

          const response = apiSuccess({ user: toSafeUser(user), csrfToken, mfaRequired: false });
          response.cookies.set(MFA_TRUST_COOKIE, trustedToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: mfaTrustCookieMaxAge(),
            path: "/",
          });
          return response;
        }
      }

      if (data.twoFactorCode) {
        const secret = decryptTotpSecret(user.twoFactorSecret);
        if (!verifyTotpCode(secret, data.twoFactorCode, TOTP_VALID_WINDOW)) {
          await logUserActivity(user.id, "MFA_LOGIN_FAILURE", { ip });
          return apiError("Invalid two-factor code", 401, "INVALID_TWO_FACTOR_CODE");
        }

        const rememberDevice = data.rememberDevice === true;
        let rawTrustedToken: string | null = null;
        if (rememberDevice) {
          rawTrustedToken = generateTrustedDeviceToken();
          await db.trustedDevice.create({
            data: {
              userId: user.id,
              tokenHash: hashTrustedDeviceToken(rawTrustedToken),
              deviceName: getDeviceName(request.headers.get("user-agent")),
              expiresAt: trustedDeviceExpiresAt(),
            },
          });
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            twoFactorLastVerifiedAt: new Date(),
          },
        });

        await createUserSession(
          user.id,
          ip,
          request.headers.get("user-agent") ?? undefined,
          {
            mfaVerified: true,
            authTime: Math.floor(Date.now() / 1000),
            emailVerified: Boolean(user.emailVerified),
          }
        );

        const csrfToken = createSignedCsrfToken();
        await setCsrfCookie(csrfToken);
        await logUserActivity(user.id, "LOGIN_MFA", { ip });

        const response = apiSuccess({ user: toSafeUser(user), csrfToken, mfaRequired: false });
        if (rawTrustedToken) {
          response.cookies.set(MFA_TRUST_COOKIE, rawTrustedToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: mfaTrustCookieMaxAge(),
            path: "/",
          });
        }
        return response;
      }

      const challengeToken = await createMfaChallengeToken(user.id);
      return apiSuccess({
        mfaRequired: true,
        challengeToken,
        message: "Two-factor verification required",
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

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

    await logUserActivity(user.id, "LOGIN", { ip });

    return apiSuccess({ user: toSafeUser(user), csrfToken });
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return apiError(
        "Sign in is temporarily unavailable because the database connection is offline. Please check the DATABASE_URL or database service status.",
        503,
        "DATABASE_UNAVAILABLE"
      );
    }

    return handleApiError(error);
  }
}

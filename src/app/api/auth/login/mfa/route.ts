import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { createUserSession, setCsrfCookie, toSafeUser } from "@/lib/auth/session";
import { logUserActivity } from "@/lib/audit";
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { db } from "@/lib/db";
import {
  decryptTotpSecret,
  generateTrustedDeviceToken,
  getDeviceName,
  hashTrustedDeviceToken,
  MFA_TRUST_COOKIE,
  mfaTrustCookieMaxAge,
  trustedDeviceExpiresAt,
  TOTP_VALID_WINDOW,
  verifyMfaChallengeToken,
} from "@/lib/security/mfa";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { verifyTotpCode } from "@/lib/security/totp";

const loginMfaSchema = z.object({
  challengeToken: z.string().min(1),
  token: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit authenticator code"),
  rememberDevice: z.boolean().optional().default(false),
  deviceName: z.string().trim().max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = loginMfaSchema.parse(await parseJsonBody(request));
    const challenge = await verifyMfaChallengeToken(body.challengeToken);

    if (!challenge) {
      return apiError("Invalid or expired two-factor challenge", 401, "INVALID_CHALLENGE");
    }

    const rateLimit = checkRateLimit(`mfa-login:${challenge.userId}:${ip}`, 8, 15 * 60 * 1000);
    if (!rateLimit.success) {
      return apiError("Too many two-factor attempts. Please try again later.", 429, "MFA_RATE_LIMITED");
    }

    const user = await db.user.findUnique({ where: { id: challenge.userId } });
    if (!user || user.deletedAt || user.isBanned || user.isSuspended) {
      return apiError("Invalid two-factor challenge", 401, "INVALID_CHALLENGE");
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return apiError("Two-factor authentication is not enabled", 400, "MFA_NOT_ENABLED");
    }

    const secret = decryptTotpSecret(user.twoFactorSecret);
    if (!verifyTotpCode(secret, body.token, TOTP_VALID_WINDOW)) {
      await logUserActivity(user.id, "MFA_LOGIN_FAILURE", { ip });
      return apiError("Invalid two-factor code", 401, "INVALID_MFA_TOKEN");
    }

    let rawTrustedToken: string | null = null;
    if (body.rememberDevice) {
      rawTrustedToken = generateTrustedDeviceToken();
      await db.trustedDevice.create({
        data: {
          userId: user.id,
          tokenHash: hashTrustedDeviceToken(rawTrustedToken),
          deviceName: body.deviceName || getDeviceName(request.headers.get("user-agent")),
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
  } catch (error) {
    return handleApiError(error);
  }
}

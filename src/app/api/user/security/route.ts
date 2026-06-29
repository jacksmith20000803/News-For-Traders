import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { generateSecret, generateURI } from "otplib";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { logUserActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  isEncryptedTotpSecret,
  TOTP_VALID_WINDOW,
} from "@/lib/security/mfa";
import { verifyTotpCode } from "@/lib/security/totp";

const MFA_ISSUER = "TradePlatform";
const MFA_QR_RATE_LIMIT_MAX = 3;
const MFA_QR_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const securitySchema = z.object({
  action: z.enum(["start_2fa_setup", "confirm_2fa", "regenerate_recovery_codes", "disable_2fa"]),
  code: z.string().trim().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = securitySchema.parse(await parseJsonBody(request));
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`mfa-settings:${user.id}:${ip}`, 10, 15 * 60 * 1000);

    if (!rateLimit.success) {
      return apiError("Too many two-factor attempts. Please try again later.", 429, "MFA_RATE_LIMITED");
    }

    if (!user.emailVerified) {
      return apiError("Verify your email before changing two-factor settings", 403, "EMAIL_NOT_VERIFIED");
    }

    if (data.action === "start_2fa_setup") {
      const qrRateLimit = checkRateLimit(
        `mfa-generate-qr:${user.id}:${ip}`,
        MFA_QR_RATE_LIMIT_MAX,
        MFA_QR_RATE_LIMIT_WINDOW_MS
      );

      if (!qrRateLimit.success) {
        return apiError(
          "Too many two-factor setup requests. Please try again later.",
          429,
          "MFA_QR_RATE_LIMITED"
        );
      }

      const existing = await db.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true },
      });

      if (existing?.twoFactorEnabled) {
        return apiError("Two-factor authentication is already enabled", 400, "MFA_ALREADY_ENABLED");
      }

      const secret = generateSecret();
      const otpauthUrl = generateURI({
        issuer: MFA_ISSUER,
        label: user.email,
        secret,
        strategy: "totp",
        digits: 6,
        period: 30,
        algorithm: "sha1",
      });

      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: encryptTotpSecret(secret),
          twoFactorEnabled: false,
          twoFactorRecoveryCodes: null,
          twoFactorLastVerifiedAt: null,
        },
      });

      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        type: "image/png",
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 6,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });

      return apiSuccess({
        twoFactorEnabled: false,
        qrCodeDataUrl,
        manualKey: secret,
        issuer: MFA_ISSUER,
        accountName: user.email,
        message: "Scan the QR code with your authenticator app, then enter the 6-digit code.",
      });
    }

    if (data.action === "confirm_2fa") {
      const existing = await db.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (existing?.twoFactorEnabled) {
        return apiError("Two-factor authentication is already enabled", 400, "MFA_ALREADY_ENABLED");
      }

      if (!existing?.twoFactorSecret) {
        return apiError("Start two-factor setup first", 400, "TWO_FACTOR_SETUP_REQUIRED");
      }

      const secret = decryptTotpSecret(existing.twoFactorSecret);

      if (!data.code || !verifyTotpCode(secret, data.code, TOTP_VALID_WINDOW)) {
        await logUserActivity(user.id, "MFA_ENROLL_CONFIRM_FAILURE", { ip });
        return apiError("Invalid two-factor code", 422, "INVALID_TWO_FACTOR_CODE");
      }

      const recoveryCodes = generateRecoveryCodes();
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: isEncryptedTotpSecret(existing.twoFactorSecret)
            ? existing.twoFactorSecret
            : encryptTotpSecret(secret),
          twoFactorRecoveryCodes: await hashRecoveryCodes(recoveryCodes),
          twoFactorLastVerifiedAt: new Date(),
        },
        select: { twoFactorEnabled: true },
      });

      await logUserActivity(user.id, "MFA_ENABLED", { ip });

      return apiSuccess({
        twoFactorEnabled: updated.twoFactorEnabled,
        recoveryCodes,
        message: "Two-factor authentication enabled",
      });
    }

    if (data.action === "regenerate_recovery_codes") {
      const existing = await db.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!existing?.twoFactorEnabled) {
        return apiError("Enable two-factor authentication before regenerating recovery codes", 400, "MFA_NOT_ENABLED");
      }

      if (!existing.twoFactorSecret) {
        return apiError("Two-factor secret is missing", 409, "MFA_SECRET_MISSING");
      }

      if (!data.code || !verifyTotpCode(decryptTotpSecret(existing.twoFactorSecret), data.code, TOTP_VALID_WINDOW)) {
        await logUserActivity(user.id, "MFA_RECOVERY_CODES_REGENERATE_FAILURE", { ip });
        return apiError("Enter a valid authenticator code to regenerate recovery codes", 422, "INVALID_TWO_FACTOR_CODE");
      }

      const recoveryCodes = generateRecoveryCodes();
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorRecoveryCodes: await hashRecoveryCodes(recoveryCodes),
          twoFactorLastVerifiedAt: new Date(),
        },
      });
      await logUserActivity(user.id, "MFA_RECOVERY_CODES_REGENERATED", { ip });

      return apiSuccess({
        recoveryCodes,
        message: "Recovery codes regenerated. Previous recovery codes are no longer valid.",
      });
    }

    const existing = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!existing?.twoFactorEnabled) {
      return apiSuccess({
        twoFactorEnabled: false,
        message: "Two-factor authentication is already disabled",
      });
    }

    if (!existing.twoFactorSecret) {
      return apiError("Two-factor secret is missing", 409, "MFA_SECRET_MISSING");
    }

    if (!data.code || !verifyTotpCode(decryptTotpSecret(existing.twoFactorSecret), data.code, TOTP_VALID_WINDOW)) {
      await logUserActivity(user.id, "MFA_DISABLE_FAILURE", { ip });
      return apiError("Enter a valid authenticator code to disable two-factor authentication", 422, "INVALID_TWO_FACTOR_CODE");
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
        twoFactorLastVerifiedAt: null,
      },
      select: { twoFactorEnabled: true },
    });
    await db.trustedDevice.deleteMany({ where: { userId: user.id } });
    await logUserActivity(user.id, "MFA_DISABLED", { ip });

    return apiSuccess({
      twoFactorEnabled: updated.twoFactorEnabled,
      message: "Two-factor authentication disabled",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

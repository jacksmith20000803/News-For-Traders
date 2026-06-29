import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { generateSecret, generateURI } from "otplib";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { logUserActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { encryptTotpSecret } from "@/lib/security/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MFA_ISSUER = "TradePlatform";
const MFA_QR_RATE_LIMIT_MAX = 3;
const MFA_QR_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface MfaQrResponse {
  qrDataUrl: string;
  qrCodeDataUrl: string;
  manualKey: string;
  issuer: typeof MFA_ISSUER;
  accountName: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);

    const user = await requireAuth();
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `mfa-generate-qr:${user.id}:${ip}`,
      MFA_QR_RATE_LIMIT_MAX,
      MFA_QR_RATE_LIMIT_WINDOW_MS
    );

    if (!rateLimit.success) {
      return apiError(
        "Too many two-factor setup requests. Please try again later.",
        429,
        "MFA_QR_RATE_LIMITED"
      );
    }

    if (!user.emailVerified) {
      return apiError(
        "Verify your email before changing two-factor settings",
        403,
        "EMAIL_NOT_VERIFIED"
      );
    }

    const existing = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    if (existing?.twoFactorEnabled) {
      return apiError(
        "Two-factor authentication is already enabled",
        400,
        "MFA_ALREADY_ENABLED"
      );
    }

    const secret = generateSecret();
    const accountName = user.email;
    const otpauthUri = generateURI({
      issuer: MFA_ISSUER,
      label: accountName,
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

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
      type: "image/png",
      errorCorrectionLevel: "H",
      margin: 2,
      scale: 6,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    await logUserActivity(user.id, "MFA_QR_GENERATED", { ip });

    return apiSuccess<MfaQrResponse>({
      qrDataUrl: qrCodeDataUrl,
      qrCodeDataUrl,
      manualKey: secret,
      issuer: MFA_ISSUER,
      accountName,
      message: "Scan the QR code with your authenticator app, then enter the 6-digit code.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

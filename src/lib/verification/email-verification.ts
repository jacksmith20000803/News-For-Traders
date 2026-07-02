import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { hashToken } from "@/lib/security/tokens";
import { sendVerificationEmail } from "@/lib/email/resend-client";
import {
  VERIFICATION_CODE_EXPIRY_MINUTES,
  VERIFICATION_LINK_EXPIRY_HOURS,
} from "@/lib/verification/constants";
import {
  generateVerificationCode,
  hashVerificationCode,
} from "@/lib/verification/code-generator";
import { randomBytes } from "crypto";

export async function createAndSendVerificationCode(userId: string, email: string) {
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const verificationToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(verificationToken);
  const codeExpiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);
  const tokenExpiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
  const verificationUrl = `${config.app.url}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId } }),
    db.emailVerificationToken.create({
      data: {
        userId,
        token: codeHash,
        attempts: 0,
        expiresAt: codeExpiresAt,
      },
    }),
    db.emailVerificationToken.create({
      data: {
        userId,
        token: tokenHash,
        attempts: 0,
        expiresAt: tokenExpiresAt,
      },
    }),
  ]);

  const delivery = await sendVerificationEmail({
    toEmail: email,
    code,
    expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    verificationUrl,
    tokenExpiryHours: VERIFICATION_LINK_EXPIRY_HOURS,
  });

  if (!delivery.ok) {
    console.error(`[email:verification] delivery failed for user ${userId}: ${delivery.error}`);
    await db.emailVerificationToken.deleteMany({ where: { userId } }).catch(() => {});
  } else {
    console.info(`[email:verification] verification email queued for user ${userId}`);
  }

  return delivery;
}

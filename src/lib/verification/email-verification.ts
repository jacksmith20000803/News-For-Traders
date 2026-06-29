import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/resend-client";
import {
  VERIFICATION_CODE_EXPIRY_MINUTES,
} from "@/lib/verification/constants";
import {
  generateVerificationCode,
  hashVerificationCode,
} from "@/lib/verification/code-generator";

export async function createAndSendVerificationCode(userId: string, email: string) {
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId } }),
    db.emailVerificationToken.create({
      data: {
        userId,
        token: codeHash,
        attempts: 0,
        expiresAt,
      },
    }),
  ]);

  const delivery = await sendVerificationEmail({
    toEmail: email,
    code,
    expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
  });

  if (!delivery.ok) {
    await db.emailVerificationToken.deleteMany({ where: { userId } }).catch(() => {});
  }

  return delivery;
}

import { randomInt } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { VERIFICATION_CODE_LENGTH } from "@/lib/verification/constants";

const MAX_CODE_VALUE = 10 ** VERIFICATION_CODE_LENGTH;

export function generateVerificationCode(): string {
  return randomInt(0, MAX_CODE_VALUE).toString().padStart(VERIFICATION_CODE_LENGTH, "0");
}

export async function hashVerificationCode(code: string): Promise<string> {
  return hashPassword(code);
}

export async function verifyCodeHash(code: string, hash: string): Promise<boolean> {
  return verifyPassword(code, hash);
}

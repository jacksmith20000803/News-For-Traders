import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";
import { hashPassword, verifyPassword } from "@/lib/security/password";

export const MFA_TRUST_DAYS = 30;
export const MFA_CHALLENGE_TOKEN_MINUTES = 5;
export const STEP_UP_MAX_AGE_SECONDS = 60;
export const RECOVERY_TOKEN_MINUTES = 10;
export const RECOVERY_CODE_COUNT = 10;
export const MAX_RECOVERY_ATTEMPTS = 5;
export const RECOVERY_LOCKOUT_HOURS = 1;
export const TOTP_VALID_WINDOW = 1;
export const MFA_TRUST_COOKIE = "nft_mfa_trust";

const ENCRYPTION_PREFIX = "enc:v1:";
const challengeSecret = new TextEncoder().encode(`${config.security.sessionSecret}:mfa-challenge`);
const recoverySecret = new TextEncoder().encode(`${config.security.sessionSecret}:mfa-recovery`);

export interface MfaTokenPayload {
  userId: string;
}

export function encryptTotpSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(ciphertext: string): string {
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    return ciphertext;
  }

  const [, ivRaw, tagRaw, encryptedRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Malformed encrypted TOTP secret");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedTotpSecret(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(ENCRYPTION_PREFIX));
}

export async function createMfaChallengeToken(userId: string): Promise<string> {
  return new SignJWT({ userId, scope: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_CHALLENGE_TOKEN_MINUTES}m`)
    .sign(challengeSecret);
}

export async function verifyMfaChallengeToken(token: string): Promise<MfaTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, challengeSecret);
    if (payload.scope !== "mfa_challenge" || typeof payload.userId !== "string") {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function createMfaRecoveryToken(userId: string): Promise<string> {
  return new SignJWT({ userId, scope: "mfa_recovery" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RECOVERY_TOKEN_MINUTES}m`)
    .sign(recoverySecret);
}

export async function verifyMfaRecoveryToken(token: string): Promise<MfaTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, recoverySecret);
    if (payload.scope !== "mfa_recovery" || typeof payload.userId !== "string") {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(8).toString("hex").match(/.{1,4}/g)?.join("-") ?? randomBytes(8).toString("hex")
  );
}

export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashes = await Promise.all(codes.map((code) => hashPassword(normalizeRecoveryCode(code))));
  return JSON.stringify(hashes);
}

export async function consumeRecoveryCode(
  storedCodes: string | null | undefined,
  providedCode: string
): Promise<{ matched: boolean; nextCodes: string | null }> {
  const normalized = normalizeRecoveryCode(providedCode);
  const hashes = parseRecoveryHashes(storedCodes);

  for (let index = 0; index < hashes.length; index += 1) {
    const hash = hashes[index];
    if (hash === "USED") continue;

    if (await verifyPassword(normalized, hash)) {
      hashes[index] = "USED";
      return { matched: true, nextCodes: JSON.stringify(hashes) };
    }
  }

  return { matched: false, nextCodes: storedCodes ?? null };
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-f0-9]/g, "").match(/.{1,4}/g)?.join("-") ?? "";
}

export function hashTrustedDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateTrustedDeviceToken(): string {
  return randomBytes(48).toString("base64url");
}

export function trustedDeviceExpiresAt(): Date {
  return new Date(Date.now() + MFA_TRUST_DAYS * 24 * 60 * 60 * 1000);
}

export function mfaTrustCookieMaxAge(): number {
  return MFA_TRUST_DAYS * 24 * 60 * 60;
}

export function getDeviceName(userAgent: string | null | undefined, fallback = "Unknown device"): string {
  if (!userAgent) return fallback;
  return userAgent.replace(/\s+/g, " ").slice(0, 255);
}

function parseRecoveryHashes(storedCodes: string | null | undefined): string[] {
  if (!storedCodes) return [];
  try {
    const parsed = JSON.parse(storedCodes);
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}

function getEncryptionKey(): Buffer {
  const source = process.env.MFA_SECRET_KEY ?? config.security.sessionSecret;
  return createHash("sha256").update(source).digest();
}

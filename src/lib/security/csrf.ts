import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { config } from "@/lib/config";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generateCsrfToken(): string {
  return generateToken(32);
}

export function signCsrfToken(token: string): string {
  const hmac = createHmac("sha256", config.security.csrfSecret);
  hmac.update(token);
  return `${token}.${hmac.digest("hex")}`;
}

export function verifyCsrfToken(signedToken: string): boolean {
  const parts = signedToken.split(".");
  if (parts.length !== 2) return false;

  const [token, signature] = parts;
  const expected = signCsrfToken(token);

  try {
    return timingSafeEqual(
      Buffer.from(signedToken),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export function createSignedCsrfToken(): string {
  return signCsrfToken(generateCsrfToken());
}

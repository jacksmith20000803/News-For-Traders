import { createHash } from "crypto";

/** Store only a hash of sensitive tokens — never the raw value. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function verifyTokenHash(raw: string, storedHash: string): boolean {
  const computed = hashToken(raw);
  if (computed.length !== storedHash.length) return false;

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

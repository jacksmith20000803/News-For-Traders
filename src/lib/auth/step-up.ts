import "server-only";

import { ApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guards";
import { getCurrentSessionPayload } from "@/lib/auth/session";
import { STEP_UP_MAX_AGE_SECONDS } from "@/lib/security/mfa";
import type { Role } from "@prisma/client";

export async function requireFreshMfa(
  maxAgeSeconds = STEP_UP_MAX_AGE_SECONDS,
  minRole: Role = "USER"
) {
  const user = await requireAuth(minRole);

  if (!user.twoFactorEnabled) {
    return user;
  }

  const payload = await getCurrentSessionPayload();
  const authTime = payload?.authTime;
  const isFresh =
    payload?.mfaVerified === true &&
    typeof authTime === "number" &&
    Math.floor(Date.now() / 1000) - authTime <= maxAgeSeconds;

  if (!isFresh) {
    throw new ApiError(
      401,
      "Fresh two-factor verification required.",
      "STEP_UP_REQUIRED"
    );
  }

  return user;
}

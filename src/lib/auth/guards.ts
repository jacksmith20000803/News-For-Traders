import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { hasMinimumRole, canAccessAdmin } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { ApiError } from "@/lib/api/response";

export async function requireAuth(minRole: Role = "USER") {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }
  if (!hasMinimumRole(user.role, minRole)) {
    throw new ApiError(403, "Insufficient permissions", "FORBIDDEN");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    throw new ApiError(403, "Administrator access required", "FORBIDDEN");
  }
  return user;
}

export async function requireModerator() {
  return requireAuth("MODERATOR");
}

/** Require a verified email for content-creation and sensitive actions. */
export async function requireVerifiedEmail() {
  const user = await requireAuth();
  if (!user.emailVerified) {
    throw new ApiError(
      403,
      "Email verification required. Check your inbox or request a new link.",
      "EMAIL_NOT_VERIFIED"
    );
  }
  return user;
}

/**
 * Double-submit CSRF: header must match cookie and pass HMAC verification.
 */
export async function validateCsrf(request: Request) {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("nft_csrf")?.value;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new ApiError(403, "Invalid CSRF token", "CSRF_INVALID");
  }

  if (!verifyCsrfToken(headerToken)) {
    throw new ApiError(403, "Invalid CSRF token", "CSRF_INVALID");
  }
}

import type { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { recordCodeRequest } from "@/lib/verification/rate-limiter";
import { createAndSendVerificationCode } from "@/lib/verification/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();

    if (user.emailVerified) {
      return apiSuccess({ message: "Email is already verified." });
    }

    const rateLimit = recordCodeRequest(user.id);
    if (!rateLimit.allowed) {
      return apiError(
        rateLimit.error ?? "Please wait before requesting another verification code.",
        429,
        "VERIFICATION_RATE_LIMITED"
      );
    }

    const delivery = await createAndSendVerificationCode(user.id, user.email);
    if (!delivery.ok) {
      return apiError(delivery.error, 502, "EMAIL_DELIVERY_FAILED");
    }

    return apiSuccess({
      message: "Verification code sent. Check your email.",
      retryAfterSeconds: rateLimit.retryAfterSeconds ?? 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

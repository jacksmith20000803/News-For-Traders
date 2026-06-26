import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { validateCsrf } from "@/lib/auth/guards";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { chatWithManagedPuterTokens } from "@/lib/puter/server";

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  model: z.string().min(1).max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);

    const ip = getClientIp(request);
    const user = await getCurrentUser();
    const rateLimit = checkRateLimit(`ai-chat:${user?.id ?? ip}`, 20, 60_000);
    if (!rateLimit.success) {
      return apiError("Too many AI requests. Please wait a moment.", 429, "RATE_LIMITED");
    }

    const body = await parseJsonBody(request);
    const data = chatSchema.parse(body);
    const response = await chatWithManagedPuterTokens({
      message: data.message,
      model: data.model,
    });

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}

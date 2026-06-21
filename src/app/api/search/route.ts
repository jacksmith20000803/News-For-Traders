import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { globalSearch } from "@/lib/search";
import { searchSchema } from "@/lib/validations/content";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `search:${ip}`,
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      const { apiError } = await import("@/lib/api/response");
      return apiError("Too many requests. Please try again later.", 429);
    }

    const { searchParams } = new URL(request.url);
    const params = searchSchema.parse({
      q: searchParams.get("q"),
      type: searchParams.get("type") ?? "all",
      page: searchParams.get("page") ?? "1",
      sort: searchParams.get("sort") ?? "newest",
    });

    const results = await globalSearch({
      q: params.q,
      type: params.type,
      page: params.page,
      sort: params.sort,
    });

    return apiSuccess(results);
  } catch (error) {
    return handleApiError(error);
  }
}

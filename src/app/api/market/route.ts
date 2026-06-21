import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { isAnyProviderConfigured, getProviderStatuses } from "@/lib/providers/news";

export async function GET() {
  try {
    const quotes = await db.marketQuote.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return apiSuccess({
      configured: isAnyProviderConfigured(),
      providers: getProviderStatuses(),
      quotes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

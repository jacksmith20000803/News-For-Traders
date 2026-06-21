import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getCachedHeatmap } from "@/lib/market/heatmap";
import { heatmapQuerySchema } from "@/lib/validations/trader";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = heatmapQuerySchema.parse({
      category: searchParams.get("category") ?? undefined,
    });

    const cells = await getCachedHeatmap(params.category);
    return apiSuccess({ cells, updatedAt: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

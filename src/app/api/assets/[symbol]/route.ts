import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAssetDetail } from "@/lib/trader/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const data = await getAssetDetail(symbol);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

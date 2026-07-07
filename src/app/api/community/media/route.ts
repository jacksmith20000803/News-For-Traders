import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guards";
import { getCommunityMediaCatalog } from "@/lib/community/media";

export async function GET() {
  try {
    await requireAuth();
    const items = await getCommunityMediaCatalog();
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}


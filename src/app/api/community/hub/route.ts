import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guards";
import { getCommunityHubData } from "@/lib/community/hub-data";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await getCommunityHubData(user.id);
    return apiSuccess({
      currentUser: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
      ...data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

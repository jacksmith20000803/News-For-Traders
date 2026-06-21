import { apiSuccess, handleApiError } from "@/lib/api/response";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { validateCsrf } from "@/lib/auth/guards";
import { logUserActivity } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    await validateCsrf(request);
    const user = await getCurrentUser();

    if (user) {
      await logUserActivity(user.id, "LOGOUT");
    }

    await destroySession();
    return apiSuccess({ message: "Logged out successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

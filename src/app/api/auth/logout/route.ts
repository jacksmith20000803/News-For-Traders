import { after } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { destroySession, getSessionToken, verifySessionToken } from "@/lib/auth/session";
import { validateCsrf } from "@/lib/auth/guards";
import { logUserActivity } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    await validateCsrf(request);
    const token = await getSessionToken();
    const payload = token ? await verifySessionToken(token) : null;

    await destroySession();
    if (payload?.userId) {
      after(() => logUserActivity(payload.userId, "LOGOUT"));
    }
    return apiSuccess({ message: "Logged out successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}

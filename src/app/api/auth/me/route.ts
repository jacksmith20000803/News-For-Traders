import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCurrentUser,
  toSafeUser,
  getOrCreateCsrfToken,
  getSessionToken,
  clearSessionCookie,
} from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const hadSessionCookie = !!(await getSessionToken());

    // Route handlers may clear stale cookies (not allowed in Server Components)
    if (!user && hadSessionCookie) {
      await clearSessionCookie();
    }

    const csrfToken = await getOrCreateCsrfToken();
    return apiSuccess({
      user: user ? toSafeUser(user) : null,
      csrfToken,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

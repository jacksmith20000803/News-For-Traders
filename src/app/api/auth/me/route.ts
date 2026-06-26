import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCurrentUser,
  toSafeUser,
  getCsrfTokenFromCookie,
  setCsrfCookie,
} from "@/lib/auth/session";
import { createSignedCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();

    const existingCsrfToken = await getCsrfTokenFromCookie();
    const hasValidCsrf = existingCsrfToken && verifyCsrfToken(existingCsrfToken);
    const csrfToken = hasValidCsrf ? existingCsrfToken : createSignedCsrfToken();
    if (!hasValidCsrf) {
      await setCsrfCookie(csrfToken);
    }
    const response = apiSuccess({
      user: user ? toSafeUser(user) : null,
      csrfToken,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

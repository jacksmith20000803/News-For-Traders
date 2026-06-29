import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { config as appConfig } from "@/lib/config";

const secret = new TextEncoder().encode(appConfig.security.sessionSecret);
const MAINTENANCE_COOKIE = "nft_maintenance";
const SESSION_COOKIE = "nft_session";

const protectedRoutes = ["/dashboard", "/admin"];
const emailVerificationRoutes = ["/verify-email", "/api/auth/verify-email", "/api/auth/send-verification-code"];

function isMaintenanceActive(request: NextRequest): boolean {
  if (appConfig.features.maintenanceMode) return true;
  return request.cookies.get(MAINTENANCE_COOKIE)?.value === "1";
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isMaintenanceActive(request) &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    pathname !== "/maintenance" &&
    pathname !== "/login"
  ) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  let isAuthenticated = false;
  let shouldClearSession = false;
  let emailVerified: boolean | undefined;

  if (sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, secret);
      isAuthenticated = true;
      emailVerified = typeof payload.emailVerified === "boolean" ? payload.emailVerified : undefined;
    } catch {
      isAuthenticated = false;
      shouldClearSession = true;
    }
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    if (shouldClearSession) clearSessionCookie(redirect);
    return redirect;
  }

  if (
    isProtected &&
    isAuthenticated &&
    emailVerified === false &&
    !emailVerificationRoutes.some((route) => pathname.startsWith(route))
  ) {
    const verifyUrl = new URL("/verify-email", request.url);
    verifyUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(verifyUrl);
  }

  const response = NextResponse.next();
  if (shouldClearSession) clearSessionCookie(response);

  response.headers.set("x-pathname", pathname);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

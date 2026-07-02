import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import {
  getDiscordAuthUrl,
  getGitHubAuthUrl,
  getGoogleAuthUrl,
  getTelegramAuthUrl,
  handleDiscordCallback,
  handleGitHubCallback,
  handleGoogleCallback,
  handleTelegramCallback,
  isDiscordOAuthConfigured,
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  isTelegramOAuthConfigured,
} from "@/lib/auth/oauth";
import { generateToken } from "@/lib/security/csrf";
import { db } from "@/lib/db";
import { config as appConfig } from "@/lib/config";
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { CSRF_COOKIE, SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/rate-limit";

export type OAuthProvider = "google" | "github" | "discord" | "telegram";
const VISITOR_COOKIE = "tradx_visitor_id";

const providers: Record<
  OAuthProvider,
  {
    configured: () => boolean;
    getUrl: (state: string, baseUrl?: string, codeChallenge?: string) => string;
    callback: (code: string, codeVerifier: string | undefined, baseUrl?: string) => Promise<unknown>;
  }
> = {
  google: {
    configured: isGoogleOAuthConfigured,
    getUrl: getGoogleAuthUrl,
    callback: (code, _codeVerifier, baseUrl) => handleGoogleCallback(code, baseUrl),
  },
  github: {
    configured: isGitHubOAuthConfigured,
    getUrl: getGitHubAuthUrl,
    callback: (code, _codeVerifier, baseUrl) => handleGitHubCallback(code, baseUrl),
  },
  discord: {
    configured: isDiscordOAuthConfigured,
    getUrl: getDiscordAuthUrl,
    callback: (code, _codeVerifier, baseUrl) => handleDiscordCallback(code, baseUrl),
  },
  telegram: {
    configured: isTelegramOAuthConfigured,
    getUrl: getTelegramAuthUrl,
    callback: (code, codeVerifier, baseUrl) => handleTelegramCallback(code, codeVerifier, baseUrl),
  },
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "github" || value === "discord" || value === "telegram";
}

export function startOAuth(request: NextRequest, provider: OAuthProvider) {
  const providerConfig = providers[provider];
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const authPage = sanitizeAuthPage(request.nextUrl.searchParams.get("authPage"));

  if (!providerConfig.configured()) {
    const fallback = `${authPage}?error=oauth_not_configured&provider=${encodeURIComponent(provider)}`;
    return NextResponse.redirect(new URL(fallback, requestBaseUrl(request)));
  }

  const state = generateToken();
  const codeVerifier = provider === "telegram" ? generateToken() : undefined;
  const codeChallenge = codeVerifier ? createCodeChallenge(codeVerifier) : undefined;
  const baseUrl = requestBaseUrl(request);
  const response = NextResponse.redirect(providerConfig.getUrl(state, baseUrl, codeChallenge));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set(`oauth_state_${provider}`, state, cookieOptions);
  response.cookies.set(`oauth_auth_page_${provider}`, authPage, cookieOptions);
  if (codeVerifier) {
    response.cookies.set(`oauth_code_verifier_${provider}`, codeVerifier, cookieOptions);
  }
  if (returnTo) {
    response.cookies.set(`oauth_return_to_${provider}`, returnTo, cookieOptions);
  }

  return response;
}

export async function finishOAuthGetCallback(request: NextRequest, provider: OAuthProvider) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  const codeVerifier = request.cookies.get(`oauth_code_verifier_${provider}`)?.value;
  const returnTo = sanitizeReturnTo(request.cookies.get(`oauth_return_to_${provider}`)?.value ?? null);
  const authPage = sanitizeAuthPage(request.cookies.get(`oauth_auth_page_${provider}`)?.value ?? null);

  return finishOAuthCallback({
    request,
    provider,
    code,
    state,
    storedState,
    codeVerifier,
    returnTo,
    authPage,
  });
}

export async function finishOAuthPostCallback(request: NextRequest, provider: OAuthProvider) {
  const form = await request.formData();
  const code = readFormValue(form.get("code"));
  const state = readFormValue(form.get("state"));
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  const codeVerifier = request.cookies.get(`oauth_code_verifier_${provider}`)?.value;
  const returnTo = sanitizeReturnTo(request.cookies.get(`oauth_return_to_${provider}`)?.value ?? null);
  const authPage = sanitizeAuthPage(request.cookies.get(`oauth_auth_page_${provider}`)?.value ?? null);

  return finishOAuthCallback({
    request,
    provider,
    code,
    state,
    storedState,
    codeVerifier,
    returnTo,
    authPage,
  });
}

async function finishOAuthCallback({
  request,
  provider,
  code,
  state,
  storedState,
  codeVerifier,
  returnTo,
  authPage,
}: {
  request: NextRequest;
  provider: OAuthProvider;
  code: string | null;
  state: string | null;
  storedState: string | undefined;
  codeVerifier: string | undefined;
  returnTo: string;
  authPage: string;
}) {
  const loginError = (message: string) =>
    NextResponse.redirect(
      new URL(`${authPage}?error=${encodeURIComponent(message)}&provider=${encodeURIComponent(provider)}`, requestBaseUrl(request))
    );

  if (!code || !state || state !== storedState) {
    return loginError("Invalid OAuth state");
  }

  try {
    const providerConfig = providers[provider];
    if (!providerConfig.configured()) {
      return loginError("OAuth provider not configured");
    }

    const user = await providerConfig.callback(code, codeVerifier, requestBaseUrl(request));
    const userId = readUserId(user);
    if (!userId) {
      return loginError("OAuth profile could not be linked");
    }
    await linkVisitorActivityToUser(request.cookies.get(VISITOR_COOKIE)?.value, userId);

    const response = NextResponse.redirect(new URL(returnTo || "/dashboard", requestBaseUrl(request)));
    await attachOAuthSessionCookies(request, response, userId);
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_return_to_${provider}`);
    response.cookies.delete(`oauth_auth_page_${provider}`);
    response.cookies.delete(`oauth_code_verifier_${provider}`);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    return loginError(message);
  }
}

async function attachOAuthSessionCookies(request: NextRequest, response: NextResponse, userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + appConfig.security.sessionMaxAge * 1000);
  const session = await db.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt,
      ipAddress: getClientIp(request),
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, 1000),
    },
  });
  const authTime = Math.floor(Date.now() / 1000);
  const jwt = await createSessionToken({
    userId,
    sessionId: session.id,
    mfaVerified: false,
    authTime,
    emailVerified: true,
  });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: appConfig.security.sessionMaxAge,
    path: "/",
  });
  response.cookies.set(CSRF_COOKIE, createSignedCsrfToken(), {
    httpOnly: false,
    secure,
    sameSite: "strict",
    maxAge: appConfig.security.sessionMaxAge,
    path: "/",
  });
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function sanitizeAuthPage(value: string | null) {
  return value === "/register" ? "/register" : "/login";
}

function readFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : null;
}

function createCodeChallenge(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function readUserId(value: unknown) {
  return value && typeof value === "object" && "id" in value && typeof value.id === "string"
    ? value.id
    : null;
}

async function linkVisitorActivityToUser(visitorId: string | undefined, userId: string | null) {
  if (!visitorId || !userId) return;
  await db.visitorActivity.updateMany({
    where: { visitorId, userId: null },
    data: { userId },
  });
}

function requestBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`;
  }

  if (["0.0.0.0", "localhost", "127.0.0.1"].includes(request.nextUrl.hostname)) {
    return appConfig.app.url;
  }

  return request.nextUrl.origin;
}

import { NextRequest, NextResponse } from "next/server";
import {
  getAppleAuthUrl,
  getGitHubAuthUrl,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  handleAppleCallback,
  handleGitHubCallback,
  handleGoogleCallback,
  handleMicrosoftCallback,
  isAppleOAuthConfigured,
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  isMicrosoftOAuthConfigured,
} from "@/lib/auth/oauth";
import { generateToken } from "@/lib/security/csrf";

export type OAuthProvider = "google" | "github" | "microsoft" | "apple";

const providers: Record<
  OAuthProvider,
  {
    configured: () => boolean;
    getUrl: (state: string, baseUrl?: string) => string;
    callback: (code: string, appleUserJson?: string | null, baseUrl?: string) => Promise<unknown>;
  }
> = {
  google: {
    configured: isGoogleOAuthConfigured,
    getUrl: getGoogleAuthUrl,
    callback: (code, _appleUserJson, baseUrl) => handleGoogleCallback(code, baseUrl),
  },
  github: {
    configured: isGitHubOAuthConfigured,
    getUrl: getGitHubAuthUrl,
    callback: (code, _appleUserJson, baseUrl) => handleGitHubCallback(code, baseUrl),
  },
  microsoft: {
    configured: isMicrosoftOAuthConfigured,
    getUrl: getMicrosoftAuthUrl,
    callback: (code, _appleUserJson, baseUrl) => handleMicrosoftCallback(code, baseUrl),
  },
  apple: {
    configured: isAppleOAuthConfigured,
    getUrl: getAppleAuthUrl,
    callback: (code, appleUserJson, baseUrl) => handleAppleCallback(code, appleUserJson, baseUrl),
  },
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "github" || value === "microsoft" || value === "apple";
}

export function startOAuth(request: NextRequest, provider: OAuthProvider) {
  const providerConfig = providers[provider];
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const authPage = sanitizeAuthPage(request.nextUrl.searchParams.get("authPage"));

  if (!providerConfig.configured()) {
    const fallback = `${authPage}?error=oauth_not_configured&provider=${encodeURIComponent(provider)}`;
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  const state = generateToken();
  const baseUrl = requestBaseUrl(request);
  const response = NextResponse.redirect(providerConfig.getUrl(state, baseUrl));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set(`oauth_state_${provider}`, state, cookieOptions);
  response.cookies.set(`oauth_auth_page_${provider}`, authPage, cookieOptions);
  if (returnTo) {
    response.cookies.set(`oauth_return_to_${provider}`, returnTo, cookieOptions);
  }

  return response;
}

export async function finishOAuthGetCallback(request: NextRequest, provider: OAuthProvider) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  const returnTo = sanitizeReturnTo(request.cookies.get(`oauth_return_to_${provider}`)?.value ?? null);
  const authPage = sanitizeAuthPage(request.cookies.get(`oauth_auth_page_${provider}`)?.value ?? null);

  return finishOAuthCallback({
    request,
    provider,
    code,
    state,
    storedState,
    returnTo,
    authPage,
  });
}

export async function finishOAuthPostCallback(request: NextRequest, provider: OAuthProvider) {
  const form = await request.formData();
  const code = readFormValue(form.get("code"));
  const state = readFormValue(form.get("state"));
  const userJson = readFormValue(form.get("user"));
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  const returnTo = sanitizeReturnTo(request.cookies.get(`oauth_return_to_${provider}`)?.value ?? null);
  const authPage = sanitizeAuthPage(request.cookies.get(`oauth_auth_page_${provider}`)?.value ?? null);

  return finishOAuthCallback({
    request,
    provider,
    code,
    state,
    storedState,
    returnTo,
    authPage,
    appleUserJson: userJson,
  });
}

async function finishOAuthCallback({
  request,
  provider,
  code,
  state,
  storedState,
  returnTo,
  authPage,
  appleUserJson,
}: {
  request: NextRequest;
  provider: OAuthProvider;
  code: string | null;
  state: string | null;
  storedState: string | undefined;
  returnTo: string;
  authPage: string;
  appleUserJson?: string | null;
}) {
  const loginError = (message: string) =>
    NextResponse.redirect(
      new URL(`${authPage}?error=${encodeURIComponent(message)}&provider=${encodeURIComponent(provider)}`, request.url)
    );

  if (!code || !state || state !== storedState) {
    return loginError("Invalid OAuth state");
  }

  try {
    const providerConfig = providers[provider];
    if (!providerConfig.configured()) {
      return loginError("OAuth provider not configured");
    }

    await providerConfig.callback(code, appleUserJson, requestBaseUrl(request));

    const response = NextResponse.redirect(new URL(returnTo || "/dashboard", request.url));
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_return_to_${provider}`);
    response.cookies.delete(`oauth_auth_page_${provider}`);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    return loginError(message);
  }
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

function requestBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

import { NextRequest, NextResponse } from "next/server";
import {
  handleGoogleCallback,
  handleGitHubCallback,
  isGoogleOAuthConfigured,
  isGitHubOAuthConfigured,
} from "@/lib/auth/oauth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  const returnTo = sanitizeReturnTo(request.cookies.get(`oauth_return_to_${provider}`)?.value ?? null);

  const loginError = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, request.url));

  if (!code || !state || state !== storedState) {
    return loginError("Invalid OAuth state");
  }

  try {
    if (provider === "google" && isGoogleOAuthConfigured()) {
      await handleGoogleCallback(code);
    } else if (provider === "github" && isGitHubOAuthConfigured()) {
      await handleGitHubCallback(code);
    } else {
      return loginError("OAuth provider not configured");
    }

    const response = NextResponse.redirect(new URL(returnTo || "/", request.url));
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_return_to_${provider}`);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return loginError(message);
  }
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

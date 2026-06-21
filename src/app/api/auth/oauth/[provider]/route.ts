import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleAuthUrl,
  getGitHubAuthUrl,
  isGoogleOAuthConfigured,
  isGitHubOAuthConfigured,
} from "@/lib/auth/oauth";
import { generateToken } from "@/lib/security/csrf";

const providers = {
  google: { configured: isGoogleOAuthConfigured, getUrl: getGoogleAuthUrl },
  github: { configured: isGitHubOAuthConfigured, getUrl: getGitHubAuthUrl },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const config = providers[provider as keyof typeof providers];

  if (!config || !config.configured()) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", _request.url));
  }

  const state = generateToken();
  const response = NextResponse.redirect(config.getUrl(state));
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}

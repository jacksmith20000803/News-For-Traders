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
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const config = providers[provider as keyof typeof providers];
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!config || !config.configured()) {
    const fallback = returnTo
      ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}connection_error=oauth_not_configured`
      : "/login?error=oauth_not_configured";
    return NextResponse.redirect(new URL(fallback, request.url));
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
  if (returnTo) {
    response.cookies.set(`oauth_return_to_${provider}`, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

  return response;
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

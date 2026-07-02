import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  getOAuthCallbackUrl,
  isAppleOAuthConfigured,
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  isMicrosoftOAuthConfigured,
} from "@/lib/auth/oauth";

const providers = ["google", "github", "microsoft", "apple"] as const;

export function GET(request: NextRequest) {
  const baseUrl = requestBaseUrl(request);

  return apiSuccess({
    baseUrl,
    providers: providers.map((provider) => ({
      provider,
      configured: isConfigured(provider),
      startUrl: `${baseUrl}/api/auth/oauth/${provider}`,
      callbackUrl: getOAuthCallbackUrl(provider, baseUrl),
    })),
  });
}

function isConfigured(provider: (typeof providers)[number]) {
  if (provider === "google") return isGoogleOAuthConfigured();
  if (provider === "github") return isGitHubOAuthConfigured();
  if (provider === "microsoft") return isMicrosoftOAuthConfigured();
  return isAppleOAuthConfigured();
}

function requestBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

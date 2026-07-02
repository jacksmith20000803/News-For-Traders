import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  getOAuthCallbackUrl,
  isDiscordOAuthConfigured,
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  isTelegramOAuthConfigured,
} from "@/lib/auth/oauth";
import { config as appConfig } from "@/lib/config";

const providers = ["google", "github", "discord", "telegram"] as const;

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
  if (provider === "discord") return isDiscordOAuthConfigured();
  return isTelegramOAuthConfigured();
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

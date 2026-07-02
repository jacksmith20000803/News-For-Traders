import { NextRequest, NextResponse } from "next/server";
import { isOAuthProvider, startOAuth } from "@/lib/auth/oauth-route-handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", request.url));
  }

  return startOAuth(request, provider);
}

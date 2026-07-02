import { NextRequest } from "next/server";
import { startOAuth } from "@/lib/auth/oauth-route-handlers";

export function GET(request: NextRequest) {
  return startOAuth(request, "github");
}

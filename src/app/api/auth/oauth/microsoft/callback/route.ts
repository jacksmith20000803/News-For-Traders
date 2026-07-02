import { NextRequest } from "next/server";
import { finishOAuthGetCallback } from "@/lib/auth/oauth-route-handlers";

export function GET(request: NextRequest) {
  return finishOAuthGetCallback(request, "microsoft");
}

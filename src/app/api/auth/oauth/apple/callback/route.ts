import { NextRequest } from "next/server";
import { finishOAuthGetCallback, finishOAuthPostCallback } from "@/lib/auth/oauth-route-handlers";

export function GET(request: NextRequest) {
  return finishOAuthGetCallback(request, "apple");
}

export function POST(request: NextRequest) {
  return finishOAuthPostCallback(request, "apple");
}

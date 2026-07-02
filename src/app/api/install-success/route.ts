import { after, NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { recordTradingBotEvent } from "@/lib/download/trading-bot-events";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  after(() =>
    recordTradingBotEvent(request, "installed").catch((error) => {
      console.error("Failed to record trading bot install:", error);
    })
  );

  if (request.nextUrl.searchParams.get("format") === "json") {
    return apiSuccess({ recorded: true, redirectTo: "/install-success" });
  }

  return NextResponse.redirect(new URL("/install-success", request.url));
}

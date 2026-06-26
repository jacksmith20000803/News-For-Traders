import { NextResponse } from "next/server";
import { updateMarketQuotes } from "@/lib/market/realtime-fetcher";

export async function GET() {
  try {
    const result = await updateMarketQuotes();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

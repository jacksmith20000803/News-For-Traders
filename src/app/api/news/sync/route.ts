import { NextResponse } from "next/server";
import { ingestNewsFromProviders } from "@/lib/providers/news/ingest";

export async function GET() {
  try {
    const result = await ingestNewsFromProviders();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

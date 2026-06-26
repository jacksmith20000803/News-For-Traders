import { updateMarketQuotes } from "@/lib/market/realtime-fetcher";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = searchParams.get("auth");
    
    // Simple auth check (in production, use proper authentication)
    if (auth !== process.env.CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await updateMarketQuotes();
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Market update cron error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

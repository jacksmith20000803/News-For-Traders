import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { eventBus } from "@/lib/events/broadcaster";
import { v4 as uuidv4 } from "uuid";
import { isDatabaseConnectivityError } from "@/lib/db-errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
  }
  const clientId = uuidv4();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // client disconnected
        }
      };

      send(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

      const unsubscribe = eventBus.subscribe({
        id: clientId,
        userId: user?.id,
        send,
        close: () => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
      });

      const heartbeat = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

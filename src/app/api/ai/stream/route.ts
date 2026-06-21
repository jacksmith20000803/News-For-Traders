import {
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { db } from "@/lib/db";
import { aiMessageSchema } from "@/lib/validations/content";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { getAIProvider, isAIConfigured } from "@/lib/providers/ai/openai";
import { logAIUsage } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAIConfigured()) {
      return apiError("AI provider not configured.", 503, "AI_NOT_CONFIGURED");
    }

    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `ai-stream:${ip}`,
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = aiMessageSchema.parse(body);

    let conversationId = data.conversationId;

    if (conversationId) {
      const conversation = await db.aIConversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
      if (!conversation) {
        return apiError("Conversation not found", 404);
      }
    } else {
      const conversation = await db.aIConversation.create({
        data: {
          userId: user.id,
          title: data.message.slice(0, 60),
        },
      });
      conversationId = conversation.id;
    }

    await db.aIMessage.create({
      data: {
        conversationId,
        role: "user",
        content: data.message,
      },
    });

    const history = await db.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const recentNews = await db.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { headline: true, sourceUrl: true },
    });

    const sources = recentNews
      .filter((n) => n.sourceUrl)
      .slice(0, 3)
      .map((n) => ({ title: n.headline, url: n.sourceUrl! }));

    const provider = getAIProvider();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, payload: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        };

        send("start", { conversationId });

        let fullContent = "";
        try {
          const result = await provider.chatStream(
            history.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
            (chunk) => {
              fullContent += chunk;
              send("chunk", { text: chunk });
            }
          );

          const aiResponse = await db.aIMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: result.content || fullContent,
              sources: sources.length ? sources : undefined,
              tokenCount: result.completionTokens,
            },
          });

          await db.aIConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          await logAIUsage({
            userId: user.id,
            conversationId,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            model: config.ai.model,
          });

          send("done", {
            conversationId,
            message: aiResponse,
          });
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "AI request failed",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

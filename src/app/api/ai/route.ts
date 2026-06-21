import {
  apiSuccess,
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

export async function GET() {
  try {
    const user = await requireAuth();
    const conversations = await db.aIConversation.findMany({
      where: { userId: user.id },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return apiSuccess({ conversations, configured: isAIConfigured() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isAIConfigured()) {
      return apiError("AI provider not configured.", 503, "AI_NOT_CONFIGURED");
    }

    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `ai:${ip}`,
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
        return apiError("Conversation not found", 404, "NOT_FOUND");
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

    const provider = getAIProvider();
    const recentNews = await db.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { headline: true, summary: true, sourceUrl: true },
    });

    const contextNews = recentNews.length
      ? `\n\nRecent headlines:\n${recentNews.map((n) => `- ${n.headline}`).join("\n")}`
      : "";

    const result = await provider.chat(
      history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }))
    );

    const sources = recentNews
      .filter((n) => n.sourceUrl)
      .slice(0, 3)
      .map((n) => ({ title: n.headline, url: n.sourceUrl! }));

    const aiResponse = await db.aIMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: result.content + (contextNews ? "" : ""),
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

    return apiSuccess({ conversationId, message: aiResponse });
  } catch (error) {
    if (error instanceof Error && error.message.includes("AI provider not configured")) {
      return apiError("AI provider not configured.", 503, "AI_NOT_CONFIGURED");
    }
    return handleApiError(error);
  }
}

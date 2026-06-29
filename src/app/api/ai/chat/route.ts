import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { validateCsrf } from "@/lib/auth/guards";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { chatWithManagedPuterTokens, type PuterAttachmentContext } from "@/lib/puter/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;

const chatSchema = z.object({
  message: z.string().max(4000).optional().default(""),
  model: z.string().min(1).max(80).optional(),
  conversationId: z.string().cuid().optional(),
});

interface ChatPayload {
  message: string;
  model?: string;
  conversationId?: string;
  attachments: PuterAttachmentContext[];
  attachmentSources: Prisma.InputJsonObject[];
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiSuccess({ conversation: null, messages: [] });
    }

    const conversation = await db.aIConversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    });

    return apiSuccess({
      conversation: conversation
        ? { id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt }
        : null,
      messages: conversation?.messages ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);

    const ip = getClientIp(request);
    const user = await getCurrentUser();
    const rateLimit = checkRateLimit(`ai-chat:${user?.id ?? ip}`, 20, 60_000);
    if (!rateLimit.success) {
      return apiError("Too many AI requests. Please wait a moment.", 429, "RATE_LIMITED");
    }

    const data = await parseChatPayload(request);
    const hasUserMessage = data.message.trim().length > 0;

    if (!hasUserMessage && data.attachments.length === 0) {
      return apiError("Message or attachment is required", 422, "MESSAGE_REQUIRED");
    }

    const effectiveMessage = hasUserMessage ? data.message.trim() : "Please analyze the attached file(s).";

    let conversationId: string | null = null;

    if (user) {
      const existingConversation = data.conversationId
        ? await db.aIConversation.findFirst({
            where: { id: data.conversationId, userId: user.id },
            select: { id: true },
          })
        : await db.aIConversation.findFirst({
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });

      if (data.conversationId && !existingConversation) {
        return apiError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
      }

      const conversation =
        existingConversation ??
        (await db.aIConversation.create({
          data: {
            userId: user.id,
            title: effectiveMessage.slice(0, 70) || "New Conversation",
          },
          select: { id: true },
        }));

      conversationId = conversation.id;
      await db.aIMessage.create({
        data: {
          conversationId,
          role: "user",
          content: effectiveMessage,
          sources:
            data.attachmentSources.length > 0
              ? ({ attachments: data.attachmentSources } as Prisma.InputJsonObject)
              : undefined,
        },
      });
    }

    const response = await chatWithManagedPuterTokens({
      message: effectiveMessage,
      model: data.model,
      attachments: data.attachments,
    });

    if (user && conversationId) {
      const assistantMessage = await db.aIMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: response.content,
        },
      });

      return apiSuccess({
        ...response,
        conversationId,
        message: assistantMessage,
      });
    }

    return apiSuccess({ ...response, conversationId: null });
  } catch (error) {
    return handleApiError(error);
  }
}

async function parseChatPayload(request: NextRequest): Promise<ChatPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "");
    const modelValue = formData.get("model");
    const conversationIdValue = formData.get("conversationId");
    const files = formData.getAll("attachments").filter((item): item is File => item instanceof File);

    if (files.length > MAX_ATTACHMENTS) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["attachments"],
          message: `Upload up to ${MAX_ATTACHMENTS} files at a time`,
        },
      ]);
    }

    const parsed = chatSchema.parse({
      message,
      model: typeof modelValue === "string" && modelValue ? modelValue : undefined,
      conversationId:
        typeof conversationIdValue === "string" && conversationIdValue
          ? conversationIdValue
          : undefined,
    });
    const processed = await processAttachments(files);

    return {
      message: parsed.message,
      model: parsed.model,
      conversationId: parsed.conversationId,
      attachments: processed.attachments,
      attachmentSources: processed.sources,
    };
  }

  const body = await parseJsonBody(request);
  const parsed = chatSchema.parse(body);
  return {
    message: parsed.message,
    model: parsed.model,
    conversationId: parsed.conversationId,
    attachments: [],
    attachmentSources: [],
  };
}

async function processAttachments(files: File[]) {
  const attachments: PuterAttachmentContext[] = [];
  const sources: Prisma.InputJsonObject[] = [];

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["attachments", file.name],
          message: `${file.name} is larger than 5MB`,
        },
      ]);
    }

    const type = file.type || inferMimeType(file.name);
    const base = {
      name: file.name || "attachment",
      type,
      size: file.size,
    };

    if (type.startsWith("image/")) {
      const dataUrl = await fileToDataUrl(file, type);
      attachments.push({ ...base, kind: "image", dataUrl });
      sources.push({ ...base, kind: "image", url: dataUrl });
      continue;
    }

    if (isTextAttachment(type, file.name)) {
      const text = (await file.text()).slice(0, 20000);
      attachments.push({ ...base, kind: "text", text });
      sources.push({ ...base, kind: "text", textExcerpt: text.slice(0, 2000) });
      continue;
    }

    throw new z.ZodError([
      {
        code: "custom",
        path: ["attachments", file.name],
        message: `${file.name} is not a supported attachment type`,
      },
    ]);
  }

  return { attachments, sources };
}

async function fileToDataUrl(file: File, contentType: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function isTextAttachment(contentType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json")
  );
}

import "server-only";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { ApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { ensurePuterTokenTable } from "@/lib/puter/schema";

const requireFromProject = createRequire(join(process.cwd(), "package.json"));

type PuterChatOptions = { model?: string };
type PuterChatResponse =
  | string
  | {
      message?: { content?: unknown };
      text?: string;
      content?: unknown;
      choices?: unknown;
    };
type PuterInstance = {
  ai: {
    chat: (
      prompt: string,
      mediaOrOptions?: string[] | PuterChatOptions,
      options?: PuterChatOptions
    ) => Promise<PuterChatResponse>;
  };
};
type PuterInit = (authToken?: string) => PuterInstance;

let puterBundleCache: string | null = null;

function getPuterBundleCode() {
  if (puterBundleCache) return puterBundleCache;

  const packageJsonPath = requireFromProject.resolve("@heyputer/puter.js/package.json");
  const bundlePath = join(dirname(packageJsonPath), "dist", "puter.cjs");
  puterBundleCache = readFileSync(bundlePath, "utf8");
  return puterBundleCache;
}

const init: PuterInit = (authToken) => {
  const hostGlobal = globalThis as unknown as Record<string, unknown>;
  const context: Record<string, unknown> = {
    PUTER_API_ORIGIN: hostGlobal.PUTER_API_ORIGIN,
    PUTER_ORIGIN: hostGlobal.PUTER_ORIGIN,
  };

  for (const name of Object.getOwnPropertyNames(globalThis)) {
    try {
      context[name] = hostGlobal[name];
    } catch {
      // Some host globals throw when accessed.
    }
  }

  context.globalThis = context;
  vm.runInNewContext(getPuterBundleCode(), vm.createContext(context));

  const puter = context.puter as PuterInstance | undefined;
  if (!puter?.ai?.chat) {
    throw new Error("AI provider failed to initialize.");
  }

  if (authToken && "setAuthToken" in puter && typeof puter.setAuthToken === "function") {
    (puter as PuterInstance & { setAuthToken: (token: string) => void }).setAuthToken(authToken);
  }

  return puter;
};

const GREETING_RESPONSE = "Hi, I'm AI Assistant of tradx. How can I help you?";
const MISSING_TOKEN_TITLE = "AI token required";
const TRADING_ASSISTANT_SYSTEM_PROMPT = `
You are AI Assistant of tradx, a concise trading support assistant.
Primary scope: trading, investing, market news, crypto/forex/stocks/commodities, charts, risk management, portfolio questions, and how to use tradx trading tools.
If the user asks something unrelated to trading or tradx, briefly steer them back to trading topics instead of continuing the unrelated topic.
If the user greets you, respond exactly: "Hi, I'm AI Assistant of tradx. How can I help you?"
If the user attaches screenshots, charts, images, or text files, analyze the supplied attachment context and mention any limitations only when the attachment content is insufficient.
If a visual example would clarify your answer, you may include a direct Markdown image link using the form ![description](url) when the user supplied or requested a relevant image URL.
Do not add unnecessary remarks, disclaimers, jokes, or long introductions.
When giving trading information, be clear, practical, and avoid claiming certainty. Do not present informational analysis as financial advice.
`.trim();

export interface PuterAttachmentContext {
  name: string;
  type: string;
  size: number;
  kind: "text" | "image";
  text?: string;
  dataUrl?: string;
}

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isGreetingOnly(message: string) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|yo|sup)[!.?\s]*$/i.test(
    message.trim()
  );
}

function buildTradingAssistantPrompt(userMessage: string, attachments: PuterAttachmentContext[] = []) {
  const attachmentContext = buildAttachmentContext(attachments);
  return `${TRADING_ASSISTANT_SYSTEM_PROMPT}${attachmentContext}\n\nUser message:\n${userMessage.trim()}`;
}

function buildAttachmentContext(attachments: PuterAttachmentContext[]) {
  if (attachments.length === 0) return "";

  const summaries = attachments.map((attachment, index) => {
    const label = `Attachment ${index + 1}: ${attachment.name} (${attachment.type || "unknown"}, ${attachment.size} bytes)`;
    if (attachment.kind === "text" && attachment.text) {
      return `${label}\nText content:\n${attachment.text.slice(0, 12000)}`;
    }
    return `${label}\nImage/screenshot is provided as visual input. Inspect it directly when answering.`;
  });

  return `\n\nAttachment context:\n${summaries.join("\n\n")}`;
}

function normalizeContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(normalizeContent).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    return JSON.stringify(value);
  }
  return "";
}

function normalizePuterResponse(response: PuterChatResponse): string {
  if (typeof response === "string") return response;
  const content =
    normalizeContent(response.message?.content) ||
    normalizeContent(response.content) ||
    response.text ||
    normalizeContent(response.choices);
  return content.trim();
}

function shouldExhaustToken(errorMessage: string): boolean {
  return /auth|token|expired|unauthorized|forbidden|quota|limit|insufficient|reauth|required/i.test(
    errorMessage
  );
}

async function notifyAdminsMissingToken(message: string) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });
  const recently = new Date(Date.now() - 30 * 60 * 1000);

  await Promise.all(
    admins.map(async (admin) => {
      const existing = await db.notification.findFirst({
        where: {
          userId: admin.id,
          title: MISSING_TOKEN_TITLE,
          read: false,
          createdAt: { gte: recently },
        },
        select: { id: true },
      });
      if (existing) return;

      await createNotification({
        userId: admin.id,
        type: "SYSTEM",
        title: MISSING_TOKEN_TITLE,
        message,
      });
    })
  );
}

export async function chatWithManagedPuterTokens(params: {
  message: string;
  model?: string;
  attachments?: PuterAttachmentContext[];
}) {
  const userMessage = params.message.trim();
  const attachments = params.attachments ?? [];
  if (attachments.length === 0 && isGreetingOnly(userMessage)) {
    return {
      content: GREETING_RESPONSE,
      model: "trading-assistant",
      tokenDisplayName: "AI Assistant",
    };
  }

  await ensurePuterTokenTable();

  const tokens = await db.puterToken.findMany({
    where: { isActive: true, isExhausted: false },
    orderBy: [{ failureCount: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  if (tokens.length === 0) {
    await notifyAdminsMissingToken("No active AI token is available for the AI assistant.");
    throw new ApiError(
      503,
      "AI is temporarily unavailable. An administrator must add an active AI token.",
      "AI_TOKEN_REQUIRED"
    );
  }

  let lastError = "No usable AI token was found.";

  for (const token of tokens) {
    const models = normalizeModels(token.selectedModels);
    const selectedModel =
      params.model && models.includes(params.model)
        ? params.model
        : models[0] ?? params.model ?? undefined;

    try {
      const puter = init(token.token);
      const prompt = buildTradingAssistantPrompt(userMessage, attachments);
      const imageInputs = attachments
        .filter((attachment) => attachment.kind === "image" && attachment.dataUrl)
        .map((attachment) => attachment.dataUrl!);
      const options = selectedModel ? { model: selectedModel } : undefined;
      const response =
        imageInputs.length > 0
          ? await puter.ai.chat(prompt, imageInputs, options)
          : await puter.ai.chat(prompt, options);
      const content = normalizePuterResponse(response);

      if (!content) throw new Error("AI returned an empty response.");

      const exhaustedByLimit = token.requestCount + 1 >= token.requestLimit;
      await db.puterToken.update({
        where: { id: token.id },
        data: {
          requestCount: { increment: 1 },
          successCount: { increment: 1 },
          isExhausted: exhaustedByLimit,
          lastError: null,
          lastUsedAt: new Date(),
        },
      });

      return {
        content,
        model: selectedModel ?? "ai-default",
        tokenDisplayName: token.displayName,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await db.puterToken.update({
        where: { id: token.id },
        data: {
          requestCount: { increment: 1 },
          failureCount: { increment: 1 },
          isExhausted: shouldExhaustToken(lastError),
          lastError: lastError.slice(0, 500),
          lastUsedAt: new Date(),
        },
      });
    }
  }

  await notifyAdminsMissingToken(`All active AI tokens failed. Last error: ${lastError}`);
  throw new ApiError(503, "AI is temporarily unavailable. Please try again later.", "AI_FAILED");
}

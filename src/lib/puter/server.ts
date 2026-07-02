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
    txt2img?: (
      promptOrOptions:
        | string
        | {
            prompt: string;
            model?: string;
            ratio?: { w: number; h: number };
            response_format?: string;
          },
      options?: {
        model?: string;
        ratio?: { w: number; h: number };
        response_format?: string;
      }
    ) => Promise<unknown>;
  };
  images?: {
    generate?: (
      options: {
        prompt: string;
        size?: string;
        model?: string;
      }
    ) => Promise<unknown>;
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
If the user asks you to create, draw, or generate an image, do not just describe it. Instead, output {{IMAGE:detailed English image description}} and then continue with a brief confirmation. The system will render the image automatically.
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please try again.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function shouldExhaustToken(errorMessage: string): boolean {
  return /expired|unauthorized|forbidden|quota|limit|insufficient|invalid token|reauth/i.test(
    errorMessage
  );
}

function selectImageModel(models: string[]) {
  return models.find((model) => /image|grok|gemini|banana|flux|dall|stable/i.test(model));
}

function normalizeImageUrl(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.url === "string") return record.url.trim();
    if (typeof record.src === "string") return record.src.trim();
    if (typeof record.currentSrc === "string") return record.currentSrc.trim();
    if (typeof record.href === "string") return record.href.trim();
    if (typeof record.image === "string") return record.image.trim();
    if (typeof record.data === "string") return record.data.trim();
    if (typeof record.output === "string") return record.output.trim();
    if (Array.isArray(record.images)) {
      const first = record.images[0];
      const url = normalizeImageUrl(first);
      if (url) return url;
    }
    if (Array.isArray(record.data)) {
      const first = record.data[0];
      const url = normalizeImageUrl(first);
      if (url) return url;
    }
    if (typeof record.toString === "function") {
      const value = record.toString();
      if (typeof value === "string" && value !== "[object Object]") return value.trim();
    }
  }
  return "";
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : typeof record.code === "string"
            ? record.code
            : "";
    const code = typeof record.code === "string" && record.code !== message ? ` (${record.code})` : "";
    if (message) return `${message}${code}`;

    try {
      return JSON.stringify(record);
    } catch {
      return "Unknown provider error.";
    }
  }
  return "Unknown provider error.";
}

async function generatePuterImage(puter: PuterInstance, prompt: string, model?: string) {
  if (puter.images?.generate) {
    try {
      return await puter.images.generate({
        prompt,
        size: "1024x1024",
        ...(model ? { model } : {}),
      });
    } catch (error) {
      if (!puter.ai.txt2img) throw error;
    }
  }

  if (puter.ai.txt2img) {
    const attempts: Array<() => Promise<unknown>> = [
      () =>
        puter.ai.txt2img!({
          prompt,
          ...(model ? { model } : {}),
          ratio: { w: 1024, h: 1024 },
        }),
      () =>
        puter.ai.txt2img!(
          prompt,
          model ? { model, ratio: { w: 1024, h: 1024 } } : { ratio: { w: 1024, h: 1024 } }
        ),
      () => puter.ai.txt2img!(prompt),
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(normalizeErrorMessage(lastError));
  }

  throw new Error("Installed AI provider does not expose image generation.");
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
    where: { isActive: true },
    orderBy: [{ isExhausted: "asc" }, { failureCount: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
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
    if (token.requestLimit > 0 && token.requestCount >= token.requestLimit) continue;

    const models = normalizeModels(token.selectedModels);
    const selectedModel =
      params.model && models.includes(params.model)
        ? params.model
        : models[0] ?? params.model ?? undefined;

    try {
      const puter = init(token.token.trim());
      const prompt = buildTradingAssistantPrompt(userMessage, attachments);
      const imageInputs = attachments
        .filter((attachment) => attachment.kind === "image" && attachment.dataUrl)
        .map((attachment) => attachment.dataUrl!);
      const options = selectedModel ? { model: selectedModel } : undefined;
      const response =
        imageInputs.length > 0
          ? await withTimeout(puter.ai.chat(prompt, imageInputs, options), 45_000, "AI assistant request")
          : await withTimeout(puter.ai.chat(prompt, options), 45_000, "AI assistant request");
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
      lastError = normalizeErrorMessage(error);
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

export async function generateImageWithManagedPuterTokens(prompt: string) {
  const imagePrompt = prompt.trim();
  if (!imagePrompt) {
    throw new ApiError(422, "Image prompt is required.", "IMAGE_PROMPT_REQUIRED");
  }

  await ensurePuterTokenTable();

  const tokens = await db.puterToken.findMany({
    where: { isActive: true },
    orderBy: [{ isExhausted: "asc" }, { failureCount: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  if (tokens.length === 0) {
    await notifyAdminsMissingToken("No active AI image-generation token is available.");
    throw new ApiError(
      503,
      "Image generation is temporarily unavailable. An administrator must add an active AI token.",
      "AI_TOKEN_REQUIRED"
    );
  }

  let lastError = "No usable AI image token was found.";

  for (const token of tokens) {
    if (token.requestLimit > 0 && token.requestCount >= token.requestLimit) continue;

    const selectedModel = selectImageModel(normalizeModels(token.selectedModels));

    try {
      const puter = init(token.token.trim());
      const result = await withTimeout(
        generatePuterImage(puter, imagePrompt, selectedModel),
        60_000,
        "Image generation"
      );
      const url = normalizeImageUrl(result);

      if (!url) {
        throw new Error("AI provider returned an empty image URL.");
      }

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
        url,
        model: selectedModel ?? "puter-image-default",
        tokenDisplayName: token.displayName,
      };
    } catch (error) {
      lastError = normalizeErrorMessage(error);
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

  await notifyAdminsMissingToken(`All active AI image tokens failed. Last error: ${lastError}`);
  throw new ApiError(503, "Image generation is temporarily unavailable. Please try again later.", "AI_IMAGE_FAILED");
}

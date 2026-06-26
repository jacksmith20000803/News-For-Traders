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
    chat: (prompt: string, options?: PuterChatOptions) => Promise<PuterChatResponse>;
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
    throw new Error("Puter.js failed to initialize.");
  }

  if (authToken && "setAuthToken" in puter && typeof puter.setAuthToken === "function") {
    (puter as PuterInstance & { setAuthToken: (token: string) => void }).setAuthToken(authToken);
  }

  return puter;
};

const MISSING_TOKEN_TITLE = "Puter token required";

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
}) {
  await ensurePuterTokenTable();

  const tokens = await db.puterToken.findMany({
    where: { isActive: true, isExhausted: false },
    orderBy: [{ failureCount: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  if (tokens.length === 0) {
    await notifyAdminsMissingToken("No active Puter token is available for the AI assistant.");
    throw new ApiError(
      503,
      "AI is temporarily unavailable. An administrator must add an active Puter token.",
      "PUTER_TOKEN_REQUIRED"
    );
  }

  let lastError = "No usable Puter token was found.";

  for (const token of tokens) {
    const models = normalizeModels(token.selectedModels);
    const selectedModel =
      params.model && models.includes(params.model)
        ? params.model
        : models[0] ?? params.model ?? undefined;

    try {
      const puter = init(token.token);
      const response = await puter.ai.chat(
        params.message,
        selectedModel ? { model: selectedModel } : undefined
      );
      const content = normalizePuterResponse(response);

      if (!content) throw new Error("Puter returned an empty response.");

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
        model: selectedModel ?? "puter-default",
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

  await notifyAdminsMissingToken(`All active Puter tokens failed. Last error: ${lastError}`);
  throw new ApiError(503, "AI is temporarily unavailable. Please try again later.", "PUTER_FAILED");
}

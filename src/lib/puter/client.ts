"use client";

import { getCsrfToken, readJsonResponse, secureFetch } from "@/lib/api/client";

export type ChatAttachment = {
  name: string;
  type: string;
  size: number;
  kind: "text" | "image";
  url?: string;
  textExcerpt?: string;
};

type ChatResponse = {
  success: boolean;
  data?: {
    content?: string;
    conversationId?: string | null;
    message?: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
      sources?: unknown;
    };
  };
  error?: string;
};

export type SavedAIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: unknown;
  attachments?: ChatAttachment[];
};

export async function loadPuterChatHistory() {
  const res = await fetch("/api/ai/chat", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await readJsonResponse<{
    success: boolean;
    data?: {
      conversation?: { id: string; title: string; updatedAt: string } | null;
      messages?: SavedAIMessage[];
    };
  }>(res).catch(() => null);

  if (!res.ok || !json?.success) {
    return { conversationId: null, messages: [] as SavedAIMessage[] };
  }

  return {
    conversationId: json.data?.conversation?.id ?? null,
    messages: (json.data?.messages ?? []).map((message) => ({
      ...message,
      attachments: extractAttachments(message.sources),
    })),
  };
}

export async function chatWithPuter(
  prompt: string,
  model?: string,
  conversationId?: string | null,
  attachments: File[] = []
) {
  const res =
    attachments.length > 0
      ? await sendMultipartChat(prompt, model, conversationId, attachments)
      : await secureFetch("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ message: prompt, model, conversationId: conversationId || undefined }),
        });
  const json: ChatResponse = await readJsonResponse<ChatResponse>(res).catch((error) => ({
    success: false,
    error: error instanceof Error ? error.message : "AI assistant is temporarily unavailable.",
  }));

  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? "AI assistant is temporarily unavailable.");
  }

  const content = json.data?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI assistant returned an empty response.");
  }

  return {
    content,
    conversationId: json.data?.conversationId ?? null,
    message: json.data?.message,
  };
}

async function sendMultipartChat(
  prompt: string,
  model: string | undefined,
  conversationId: string | null | undefined,
  attachments: File[]
) {
  const formData = new FormData();
  formData.append("message", prompt);
  if (model) formData.append("model", model);
  if (conversationId) formData.append("conversationId", conversationId);
  for (const file of attachments) {
    formData.append("attachments", file);
  }

  return fetch("/api/ai/chat", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
    body: formData,
  });
}

function extractAttachments(sources: unknown): ChatAttachment[] {
  if (!sources || typeof sources !== "object" || !("attachments" in sources)) return [];
  const attachments = (sources as { attachments?: unknown }).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item): item is ChatAttachment => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ChatAttachment>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.type === "string" &&
      typeof candidate.size === "number" &&
      (candidate.kind === "text" || candidate.kind === "image")
    );
  });
}

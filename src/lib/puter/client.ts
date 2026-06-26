"use client";

import { readJsonResponse, secureFetch } from "@/lib/api/client";

type ChatResponse = {
  success: boolean;
  data?: { content?: string };
  error?: string;
};

export async function chatWithPuter(prompt: string, model?: string) {
  const res = await secureFetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message: prompt, model }),
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

  return content;
}

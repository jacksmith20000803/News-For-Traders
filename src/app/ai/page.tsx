"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  Square,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_SUGGESTED_PROMPTS } from "@/lib/constants";
import { getCsrfToken } from "@/lib/api/client";
import { clientId } from "@/lib/client-id";
import {
  ChatMessage,
  TypingIndicator,
  StreamingMessage,
  type ChatMessageData,
} from "@/components/ai/chat-message";
import { parseAIStream } from "@/components/realtime/sse-provider";

const STREAMING_ID = "__streaming__"; // reserved for stop-generation cleanup

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then((json) => setConfigured(json.data?.configured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (streamingContent) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== STREAMING_ID),
        {
          id: clientId("msg"),
          role: "assistant",
          content: streamingContent + "\n\n*(Generation stopped)*",
        },
      ]);
      setStreamingContent("");
    }
    setIsLoading(false);
  }, [streamingContent]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !configured) return;

      setLastFailedPrompt(null);
      const userMsg: ChatMessageData = {
        id: clientId("user"),
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const csrf = await getCsrfToken();
        const res = await fetch("/api/ai/stream", {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({ conversationId, message: text.trim() }),
        });

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Request failed");
        }

        let fullContent = "";
        let doneMessageId: string | null = null;

        await parseAIStream(
          res.body.getReader(),
          {
            onStart: (data) => {
              if (data.conversationId) setConversationId(data.conversationId);
            },
            onChunk: (chunk) => {
              fullContent += chunk;
              setStreamingContent(fullContent);
            },
            onDone: (data) => {
              if (data.conversationId) setConversationId(data.conversationId);
              if (data.message?.id) {
                doneMessageId = data.message.id;
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === data.message.id);
                  if (exists) return prev;
                  return [
                    ...prev,
                    {
                      id: data.message.id,
                      role: "assistant",
                      content: data.message.content,
                      sources: data.message.sources as ChatMessageData["sources"],
                    },
                  ];
                });
              }
              setStreamingContent("");
            },
            onError: (msg) => {
              throw new Error(msg);
            },
          },
          controller.signal
        );

        if (fullContent && !doneMessageId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.content === fullContent && m.role === "assistant");
            if (exists) return prev;
            return [
              ...prev,
              { id: clientId("msg"), role: "assistant", content: fullContent },
            ];
          });
          setStreamingContent("");
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        const errorMsg =
          err instanceof Error
            ? err.message
            : "Unable to process your request. Please sign in and try again.";

        setLastFailedPrompt(text.trim());
        setMessages((prev) => [
          ...prev,
          {
            id: clientId("err"),
            role: "assistant",
            content: errorMsg,
            error: true,
          },
        ]);
        setStreamingContent("");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [conversationId, configured, isLoading]
  );

  if (configured === null) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="typing-dot h-3 w-3 rounded-full bg-cyan-400" />
      </div>
    );
  }

  if (configured === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="glass-panel mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-2 gradient-text">AI provider not configured</h1>
        <p className="text-muted-foreground text-sm">
          Set OPENAI_API_KEY or AI_API_KEY in your environment to enable the AI assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">AI Market Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by live market data</p>
          </div>
        </div>
        {lastFailedPrompt && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage(lastFailedPrompt)}
            disabled={isLoading}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-1 mb-4">
        {messages.length === 0 && !streamingContent && !isLoading && (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-amber-400" />
            <p className="mb-1 font-medium">Ask anything about the markets</p>
            <p className="mb-6 text-sm text-muted-foreground">
              Real-time analysis with source citations
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {AI_SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-xs text-cyan-300 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {streamingContent && <StreamingMessage content={streamingContent} />}

        {isLoading && !streamingContent && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="glass-panel rounded-2xl p-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask about market events, trends, or analysis…"
          disabled={isLoading}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {isLoading ? (
          <Button
            size="icon"
            variant="outline"
            onClick={stopGeneration}
            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        <Zap className="inline h-3 w-3 text-amber-400 mr-0.5" />
        AI analysis is informational only — not financial advice.{" "}
        <Link href="/knowledge" className="text-cyan-400 hover:underline">
          View research
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_SUGGESTED_PROMPTS } from "@/lib/constants";
import { clientId } from "@/lib/client-id";
import {
  ChatMessage,
  TypingIndicator,
  type ChatMessageData,
} from "@/components/ai/chat-message";
import { chatWithPuter } from "@/lib/puter/client";

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setLastFailedPrompt(null);
      const userMsg: ChatMessageData = {
        id: clientId("user"),
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await chatWithPuter(text.trim());
        setMessages((prev) => [
          ...prev,
          { id: clientId("msg"), role: "assistant", content: response.content },
        ]);
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Unable to process your request. Please try again.";

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
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

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
            <p className="text-xs text-muted-foreground">Powered by AI</p>
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
        {messages.length === 0 && !isLoading && (
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

        {isLoading && <TypingIndicator />}

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
            disabled
            className="shrink-0"
            aria-label="Generating response"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
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

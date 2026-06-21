"use client";

import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: { title: string; url: string }[];
  error?: boolean;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3 animate-fade-in", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          isUser
            ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
            : "glass-panel text-cyan-400"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-cyan-600/90 to-blue-700/90 text-white shadow-lg shadow-blue-500/10"
            : message.error
              ? "glass-panel border border-destructive/30 text-destructive"
              : "glass-panel"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-a:text-cyan-400">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((s) => (
                <a
                  key={`${message.id}-${s.url}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="glass-panel flex h-8 w-8 items-center justify-center rounded-xl text-cyan-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="glass-panel flex items-center gap-1.5 rounded-2xl px-4 py-3">
        <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400" />
        <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400 [animation-delay:0.15s]" />
        <span className="typing-dot h-2 w-2 rounded-full bg-cyan-400 [animation-delay:0.3s]" />
      </div>
    </div>
  );
}

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="glass-panel flex h-8 w-8 items-center justify-center rounded-xl text-cyan-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="glass-panel max-w-[85%] rounded-2xl px-4 py-3 text-sm">
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cyan-400" />
      </div>
    </div>
  );
}

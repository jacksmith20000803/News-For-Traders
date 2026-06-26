"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { chatWithPuter } from "@/lib/puter/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function AIChatModal() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);

    try {
      const content = await chatWithPuter(userMessage);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: error instanceof Error ? error.message : "Sorry, something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="ask-ai-launcher fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300/40 bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500 hover:shadow-[0_22px_56px_rgba(16,185,129,0.48)]"
      >
        <span className="ask-ai-orb" aria-hidden="true" />
        <Bot className="relative z-10 h-5 w-5" />
        <span className="relative z-10">Ask AI</span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] rounded-2xl border backdrop-blur-xl shadow-2xl ${
      currentTheme === "dark" 
        ? "border-white/10 bg-[#0a0c0c]" 
        : "border-gray-300 bg-white"
    }`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${
        currentTheme === "dark" ? "border-white/10" : "border-gray-200"
      }`}>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className={`font-semibold ${currentTheme === "dark" ? "text-white" : "text-gray-900"}`}>AI Assistant</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className={`rounded-lg p-1 hover:bg-white/5 hover:text-foreground ${
            currentTheme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="h-[400px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="space-y-2">
              <Bot className="h-12 w-12 mx-auto text-primary/50" />
              <p className={`text-sm ${currentTheme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Start a conversation with the AI assistant
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : currentTheme === "dark" ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
              currentTheme === "dark" ? "bg-white/10" : "bg-gray-100"
            }`}>
              <Loader2 className={`h-4 w-4 animate-spin ${currentTheme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
              <span className={`text-sm ${currentTheme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className={`border-t p-4 ${
        currentTheme === "dark" ? "border-white/10" : "border-gray-200"
      }`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary/30 placeholder:text-muted-foreground ${
              currentTheme === "dark" 
                ? "border-white/10 bg-white/5 text-white" 
                : "border-gray-300 bg-gray-50 text-gray-900"
            }`}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className={`mt-2 text-center text-xs ${
          currentTheme === "dark" ? "text-gray-400" : "text-gray-600"
        }`}>
          Powered by admin-managed Puter tokens.
        </p>
      </form>
    </div>
  );
}

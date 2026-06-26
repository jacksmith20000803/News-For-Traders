"use client";

import { useEffect, useRef, useState } from "react";
import { secureFetch } from "@/lib/api/client";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  isAdmin: boolean;
  createdAt: string;
  senderId: string;
}

export function SupportChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [adminOnline, setAdminOnline] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/support")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setConversationId(json.data.conversation.id);
          setMessages(json.data.messages);
          setAdminOnline(json.data.adminOnline);
        }
      });
  }, []);

  useEffect(() => {
    const unsub = subscribeSSE((channel, data) => {
      if (channel !== "chat") return;
      const msg = data as Message & { conversationId: string };
      if (msg.conversationId === conversationId) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return unsub;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const res = await secureFetch("/api/support", {
      method: "POST",
      body: JSON.stringify({ content: input.trim(), conversationId }),
    });
    const json = await res.json();
    if (json.success) {
      setMessages((prev) => [...prev, json.data.message]);
      setConversationId(json.data.conversationId);
      setInput("");
    }
  };

  return (
    <div className="dash-panel flex h-[500px] flex-col rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="font-semibold">Support Chat</h2>
        <span className={cn("text-xs", adminOnline ? "text-emerald-400" : "text-muted-foreground")}>
          {adminOnline ? "● Admin online" : "○ Admin offline"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Start a conversation with our support team
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[80%] rounded-xl px-3 py-2 text-sm",
              m.isAdmin
                ? "mr-auto bg-white/5 text-foreground"
                : "ml-auto bg-emerald-500/20 text-emerald-100"
            )}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-white/5 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm"
        />
        <Button size="icon" onClick={send} className="bg-emerald-600">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

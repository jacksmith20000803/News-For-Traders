"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected";

interface SSEContextValue {
  status: ConnectionState;
}

const SSEContext = createContext<SSEContextValue>({ status: "connecting" });

export function useConnectionStatus() {
  return useContext(SSEContext);
}

type SSEHandler = (event: string, data: unknown) => void;

const handlers = new Set<SSEHandler>();

export function subscribeSSE(handler: SSEHandler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

interface SSEProviderProps {
  children: ReactNode;
}

export function SSEProvider({ children }: SSEProviderProps) {
  const [status, setStatus] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      setStatus((s) => (s === "connected" ? "connected" : "connecting"));
      source = new EventSource("/api/events");

      source.addEventListener("connected", () => {
        if (mounted) setStatus("connected");
      });

      const channels = ["news", "notification", "market", "chat"] as const;
      for (const channel of channels) {
        source.addEventListener(channel, (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            handlers.forEach((h) => h(channel, data));
          } catch {
            // ignore malformed events
          }
        });
      }

      source.onerror = () => {
        if (!mounted) return;
        setStatus("reconnecting");
        source?.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    const initialConnect = setTimeout(connect, 1500);

    return () => {
      mounted = false;
      clearTimeout(initialConnect);
      clearTimeout(retryTimeout);
      source?.close();
      setStatus("disconnected");
    };
  }, []);

  return <SSEContext.Provider value={{ status }}>{children}</SSEContext.Provider>;
}

export async function parseAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: {
    onStart?: (data: { conversationId: string }) => void;
    onChunk?: (text: string) => void;
    onDone?: (data: {
      conversationId: string;
      message: {
        id: string;
        role: string;
        content: string;
        sources?: { title: string; url: string }[];
      };
    }) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) break;

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim() || block.startsWith(":")) continue;

      let eventType = "message";
      let dataStr = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }

      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        switch (eventType) {
          case "start":
            callbacks.onStart?.(data);
            break;
          case "chunk":
            if (data.text) callbacks.onChunk?.(data.text);
            break;
          case "done":
            callbacks.onDone?.(data);
            break;
          case "error":
            callbacks.onError?.(data.message ?? "Stream error");
            break;
        }
      } catch {
        // skip malformed block
      }
    }
  }
}

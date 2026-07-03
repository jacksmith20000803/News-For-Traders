"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Bot,
  X,
  Send,
  Loader2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
  PlugZap,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { MessageRenderer } from "@/components/chat/message-renderer";
import {
  chatWithPuter,
  deletePuterChatMessage,
  loadPuterChatHistory,
  type ChatAttachment,
} from "@/lib/puter/client";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

interface AttachmentDraft {
  id: string;
  file: File;
  previewUrl?: string;
}

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;

export function AIChatModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messagesOverflow, setMessagesOverflow] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const { theme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const openModal = () => {
    setClosing(false);
    setOpen(true);
  };

  const closeModal = () => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 260);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const element = messagesContainerRef.current;
    if (!open || !element) return;

    let frame = window.requestAnimationFrame(() => {
      setMessagesOverflow(element.scrollHeight > element.clientHeight + 1);
    });
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setMessagesOverflow(element.scrollHeight > element.clientHeight + 1);
      });
    });

    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [historyLoading, loading, messages, open]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const url of previewUrls) {
        URL.revokeObjectURL(url);
      }
      previewUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    if (!userId) {
      window.queueMicrotask(() => {
        if (cancelled) return;
        setConversationId(null);
        setMessages([]);
      });
      return;
    }

    window.queueMicrotask(() => {
      if (cancelled) return;
      setHistoryLoading(true);
      loadPuterChatHistory()
        .then((history) => {
          if (cancelled) return;
          setConversationId(history.conversationId);
          setMessages(
            history.messages
              .filter((message) => message.role === "user" || message.role === "assistant")
              .map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
                createdAt: message.createdAt,
                attachments: message.attachments,
              }))
          );
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const addAttachmentFiles = (selectedFiles: File[]) => {
    setAttachmentError("");
    if (selectedFiles.length === 0) return;

    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (availableSlots === 0) {
      setAttachmentError(`Upload up to ${MAX_ATTACHMENTS} files at a time.`);
      inputRef.current?.focus();
      return;
    }

    const nextAttachments: AttachmentDraft[] = [];
    let nextError = "";

    for (const [index, selectedFile] of selectedFiles.entries()) {
      const file = normalizeAttachmentFile(selectedFile, index);
      if (nextAttachments.length >= availableSlots) {
        nextError = `Upload up to ${MAX_ATTACHMENTS} files at a time.`;
        break;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        nextError = `${file.name || "This file"} is larger than 5MB.`;
        continue;
      }
      if (!isSupportedAttachment(file)) {
        nextError = `${file.name || "This file"} is not a supported file type.`;
        continue;
      }
      const type = file.type || inferClientMimeType(file.name);
      const previewUrl = type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (previewUrl) previewUrlsRef.current.add(previewUrl);
      nextAttachments.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${createClientId()}`,
        file,
        previewUrl,
      });
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments]);
    }
    if (nextError) setAttachmentError(nextError);

    if (fileInputRef.current) fileInputRef.current.value = "";
    inputRef.current?.focus();
  };

  const handleAttachmentSelect = (files: FileList | null) => {
    addAttachmentFiles(Array.from(files ?? []));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const clipboardFiles = Array.from(event.clipboardData.files ?? []);
    const itemFiles = Array.from(event.clipboardData.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const files = clipboardFiles.length > 0 ? clipboardFiles : itemFiles;

    if (files.length === 0) return;
    event.preventDefault();
    addAttachmentFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    addAttachmentFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
    inputRef.current?.focus();
  };

  const copyMessage = async (message: Message) => {
    const text = message.content.trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => (current === message.id ? null : current)), 1600);
    } catch {
      setAttachmentError("Could not copy this message.");
    } finally {
      inputRef.current?.focus();
    }
  };

  const deleteMessage = async (message: Message) => {
    setDeletingMessageId(message.id);
    setAttachmentError("");
    const previousMessages = messages;
    setMessages((current) => current.filter((item) => item.id !== message.id));

    try {
      if (isPersistedAIMessageId(message.id)) {
        await deletePuterChatMessage(message.id);
      }
    } catch (error) {
      setMessages(previousMessages);
      setAttachmentError(error instanceof Error ? error.message : "Could not delete this message.");
    } finally {
      setDeletingMessageId(null);
      inputRef.current?.focus();
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage = input.trim();
    const filesToSend = attachments.map((attachment) => attachment.file);
    const messageAttachments = attachments.map(toChatAttachment);
    setInput("");
    setAttachmentError("");
    setAttachments([]);
    setLoading(true);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage || "Please analyze the attached file(s).",
      createdAt: new Date().toISOString(),
      attachments: messageAttachments,
    };

    setMessages((prev) => [...prev, newMessage]);
    try {
      const response = await chatWithPuter(userMessage, undefined, conversationId, filesToSend);
      setConversationId(response.conversationId ?? conversationId);
      if (response.userMessage?.id) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === newMessage.id
              ? {
                  ...message,
                  id: response.userMessage!.id,
                  createdAt: response.userMessage!.createdAt ?? message.createdAt,
                }
              : message
          )
        );
      }

      const assistantMessage: Message = {
        id: response.message?.id ?? (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        createdAt: response.message?.createdAt ?? new Date().toISOString(),
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
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!open) {
    return (
      <button
        onClick={openModal}
        aria-label="Open AI assistant"
        data-tooltip="false"
        style={{position: "fixed"}}
        className="ask-ai-launcher fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300/40 bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500 hover:shadow-[0_22px_56px_rgba(16,185,129,0.48)]"
      >
        <span className="ask-ai-orb" aria-hidden="true" />
        <Bot className="relative z-10 h-5 w-5" />
        <span className="relative z-10">Ask AI</span>
      </button>
    );
  }

  return (
    <div
      className={`ai-scroll-modal fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border bg-cover bg-center shadow-2xl ${closing ? "ai-scroll-modal-closing" : ""} ${
      currentTheme === "dark" 
        ? "border-white/10"
        : "border-gray-300"
    }`}
      style={{ backgroundImage: "url('/default-news.webp')" }}
    >
      <div className={`absolute inset-0 ${currentTheme === "dark" ? "bg-[#06100e]/92" : "bg-white/90"} backdrop-blur-sm`} />
      <div className={`relative flex items-center justify-between border-b px-4 py-3 ${
        currentTheme === "dark" ? "border-white/10" : "border-gray-200"
      }`}>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className={`font-semibold ${currentTheme === "dark" ? "text-white" : "text-gray-900"}`}>AI Assistant</span>
        </div>
        <button
          onClick={closeModal}
          className={`rounded-lg p-1 hover:bg-white/5 hover:text-foreground ${
            currentTheme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className={cn(
          "relative h-[400px] space-y-4 p-4",
          messagesOverflow ? "overflow-y-auto" : "overflow-y-hidden"
        )}
      >
        {historyLoading ? (
          <div className="flex h-full items-center justify-center">
            <ModalLoader />
          </div>
        ) : messages.length === 0 ? (
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
                className={`group/message relative max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${
                  msg.role === "user"
                    ? "bg-pink-100 text-pink-950 dark:bg-pink-300/25 dark:text-pink-50"
                    : "bg-emerald-100 text-emerald-950 dark:bg-emerald-300/20 dark:text-emerald-50"
                }`}
              >
                <div>
                  <MessageRenderer content={msg.content} />
                  {msg.attachments && msg.attachments.length > 0 && (
                    <AttachmentPreviewList attachments={msg.attachments} />
                  )}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55">
                      {formatMessageTime(msg.createdAt)}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => copyMessage(msg)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 ${
                          msg.role === "user"
                            ? "border-pink-300/60 bg-white/70 text-pink-800 hover:bg-pink-50 dark:border-pink-200/20 dark:bg-pink-950/50 dark:text-pink-100"
                            : "border-emerald-300/60 bg-white/70 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-200/20 dark:bg-emerald-950/50 dark:text-emerald-100"
                        }`}
                        aria-label={copiedMessageId === msg.id ? "Message copied" : "Copy message"}
                        data-tooltip="false"
                      >
                        {copiedMessageId === msg.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteMessage(msg)}
                        disabled={deletingMessageId === msg.id}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 ${
                          msg.role === "user"
                            ? "border-pink-300/60 bg-white/70 text-pink-800 hover:bg-red-50 hover:text-red-600 dark:border-pink-200/20 dark:bg-pink-950/50 dark:text-pink-100"
                            : "border-emerald-300/60 bg-white/70 text-emerald-800 hover:bg-red-50 hover:text-red-600 dark:border-emerald-200/20 dark:bg-emerald-950/50 dark:text-emerald-100"
                        }`}
                        aria-label="Delete message"
                        data-tooltip="false"
                      >
                        {deletingMessageId === msg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="ai-thinking-edge relative flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-100 px-3 py-2 text-emerald-950 shadow-sm dark:bg-emerald-300/20 dark:text-emerald-50">
              <ModalLoader compact />
              <span className="relative z-10 text-sm font-semibold opacity-80">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className={`relative border-t p-4 ${
        currentTheme === "dark" ? "border-white/10" : "border-gray-200"
      }`}>
        {attachmentError && <p className="mb-2 text-xs text-red-500">{attachmentError}</p>}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border p-2 shadow-inner transition-all ${
            dragActive
              ? "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/30"
              : currentTheme === "dark"
                ? "border-white/10 bg-black/30"
                : "border-gray-300 bg-white/80"
          }`}
        >
          {attachments.length > 0 && (
            <div className="mb-2 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative overflow-hidden rounded-xl border border-emerald-300/25 bg-white/90 text-xs text-gray-900 shadow-sm dark:bg-black/50 dark:text-white"
                >
                  {attachment.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.previewUrl}
                      alt={`Preview of ${attachment.file.name || "pasted image"}`}
                      className="block h-24 w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-full items-center justify-center bg-emerald-500/10">
                      <FileText className="h-4 w-4 text-emerald-500" />
                    </span>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    {attachment.previewUrl ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    )}
                    <span className="min-w-0 truncate">{attachment.file.name || "Pasted image"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white shadow-sm hover:bg-red-500"
                    aria-label={`Remove ${attachment.file.name || "attachment"}`}
                    data-tooltip="false"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="text/*,application/json,image/*,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif"
              className="hidden"
              onChange={(event) => handleAttachmentSelect(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border bg-background/80 px-3 py-2 text-muted-foreground transition-colors hover:text-emerald-500"
              aria-label="Upload attachment"
              data-tooltip="false"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type your message..."
              className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-primary/30 placeholder:text-muted-foreground ${
                currentTheme === "dark"
                  ? "border-white/10 bg-white/5 text-white"
                  : "border-gray-200 bg-gray-50 text-gray-900"
              }`}
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && attachments.length === 0)}
              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          {dragActive && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-500">
              Drop files here to attach
            </p>
          )}
        </div>
      </form>
      <div className={`relative border-t px-4 py-3 ${
        currentTheme === "dark" ? "border-white/10 bg-black/20" : "border-gray-200 bg-white/70"
      }`}>
        {/* MSIX download filename retained for future use: download="trading-bot-app.msix" */}
        <a
          href="/api/download/trading-bot-app"
          download="TradX-Bot.exe"
          data-track-event="promo_download_click"
          data-track-label="Download Trading Bot"
          data-track-component="trading-bot-promo"
          data-track-kind="download"
          data-track-href="/api/download/trading-bot-app"
          className="tradx-rotating-gradient-button group relative inline-flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(139,92,246,0.35)] transition-all hover:-translate-y-1 hover:brightness-110 active:translate-y-0.5 active:scale-95"
        >
          <PlugZap className="relative z-10 h-4 w-4" aria-hidden="true" />
          <span className="relative z-10">Download Trading Bot</span>
          <ChevronRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function AttachmentPreviewList({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <div className="mt-2 grid gap-2">
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.name}-${attachment.size}-${index}`}
          className="overflow-hidden rounded-xl border border-white/20 bg-white/60 text-xs dark:bg-black/20"
        >
          {attachment.kind === "image" && attachment.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.name}
              className="block aspect-video w-full object-cover"
            />
          ) : null}
          <div className="flex items-center gap-2 px-2 py-1.5">
            {attachment.kind === "image" ? (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate font-medium">{attachment.name}</span>
            <span className="ml-auto shrink-0 opacity-70">{formatBytes(attachment.size)}</span>
          </div>
          {attachment.kind === "text" && attachment.textExcerpt ? (
            <p className="max-h-24 overflow-hidden border-t border-white/20 px-2 py-1.5 text-[11px] opacity-80">
              {attachment.textExcerpt}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ModalLoader({ compact = false }: { compact?: boolean }) {
  const ringSize = compact ? "h-9 w-9" : "h-24 w-24";
  const innerRingSize = compact ? "h-7 w-7" : "h-20 w-20";
  const logoSize = compact ? 28 : 72;

  return (
    <div className={cn("flex flex-col items-center justify-center", compact ? "gap-1" : "gap-4")}>
      <div className={cn("relative flex items-center justify-center", compact ? "h-10 w-10" : "h-28 w-28")}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn("rounded-full border-2 border-emerald-500/20 animate-spin", ringSize)}
            style={{ animationDuration: "3s" }}
          />
          <div
            className={cn("absolute rounded-full border-2 border-emerald-500/35 animate-spin", innerRingSize)}
            style={{ animationDuration: "2s", animationDirection: "reverse" }}
          />
        </div>
        <div className="relative z-10 flex items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/10 blur-xl" />
          <Image
            src="/tradx-logo.webp"
            alt="TRADX"
            width={logoSize}
            height={logoSize}
            className={cn("relative z-10 object-contain", compact ? "h-7 w-7" : "h-[72px] w-[72px]")}
            style={{ width: logoSize, height: logoSize }}
          />
        </div>
      </div>
      {!compact && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Loading</p>
        </>
      )}
    </div>
  );
}

function isSupportedAttachment(file: File) {
  const type = file.type || inferClientMimeType(file.name);
  const name = file.name.toLowerCase();
  return (
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type === "application/json" ||
    /\.(txt|md|csv|json|png|jpe?g|webp|gif)$/i.test(name)
  );
}

function normalizeAttachmentFile(file: File, index: number) {
  const type = file.type || inferClientMimeType(file.name);
  if (file.name) return file;

  const fallbackName = type.startsWith("image/")
    ? `pasted-screenshot-${Date.now()}-${index}.${mimeExtension(type)}`
    : `attachment-${Date.now()}-${index}.txt`;

  return new File([file], fallbackName, {
    type,
    lastModified: file.lastModified || Date.now(),
  });
}

function toChatAttachment(attachment: AttachmentDraft): ChatAttachment {
  const type = attachment.file.type || inferClientMimeType(attachment.file.name);
  return {
    name: attachment.file.name,
    type,
    size: attachment.file.size,
    kind: type.startsWith("image/") ? "image" : "text",
    url: attachment.previewUrl,
  };
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mimeExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/png") return "png";
  return "png";
}

function inferClientMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function isPersistedAIMessageId(id: string) {
  return /^c[a-z0-9]{8,}$/i.test(id);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

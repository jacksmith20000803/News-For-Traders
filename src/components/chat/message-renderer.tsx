"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Download, Loader2, Maximize2, Minus, Plus, X } from "lucide-react";
import { useImageGeneration, type ImageGenerationState } from "@/hooks/use-image-generation";
import { cn } from "@/lib/utils";

type MessageSegment =
  | { type: "text"; value: string; key: string }
  | { type: "image"; prompt: string; key: string };

interface MessageRendererProps {
  content: string;
}

type OpenImage = {
  url: string;
  prompt: string;
};

const imageMarkerPattern = /\{\{IMAGE:([\s\S]+?)\}\}/g;

export function MessageRenderer({ content }: MessageRendererProps) {
  const segments = useMemo(() => parseMessageSegments(content), [content]);
  const prompts = useMemo(
    () =>
      Array.from(
        new Set(
          segments
            .filter((segment): segment is Extract<MessageSegment, { type: "image" }> => segment.type === "image")
            .map((segment) => segment.prompt)
        )
      ),
    [segments]
  );
  const imageResults = useImageGeneration(prompts);
  const [openImage, setOpenImage] = useState<OpenImage | null>(null);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {segments.map((segment) => {
        if (segment.type === "text") {
          const trimmed = segment.value.trim();
          if (!trimmed) return null;
          return (
            <div key={segment.key} className="ai-message-markdown whitespace-normal break-words">
              <ReactMarkdown>{trimmed}</ReactMarkdown>
            </div>
          );
        }

        return (
          <GeneratedImageBlock
            key={segment.key}
            prompt={segment.prompt}
            state={imageResults[segment.prompt]}
            onOpen={(url) => setOpenImage({ url, prompt: segment.prompt })}
          />
        );
      })}

      {openImage ? (
        <GeneratedImageViewer image={openImage} onClose={() => setOpenImage(null)} />
      ) : null}
    </div>
  );
}

function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  let index = 0;

  for (const match of content.matchAll(imageMarkerPattern)) {
    const fullMatch = match[0];
    const prompt = (match[1] ?? "").trim();
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, start),
        key: `text-${index}`,
      });
      index += 1;
    }

    if (prompt) {
      segments.push({
        type: "image",
        prompt,
        key: `image-${index}-${prompt.slice(0, 24)}`,
      });
      index += 1;
    }

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      value: content.slice(lastIndex),
      key: `text-${index}`,
    });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: content, key: "text-0" }];
}

function GeneratedImageBlock({
  prompt,
  state,
  onOpen,
}: {
  prompt: string;
  state?: ImageGenerationState;
  onOpen: (url: string) => void;
}) {
  if (!state || state.loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/30 bg-white/60 p-3 text-emerald-900 shadow-sm dark:bg-black/25 dark:text-emerald-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        <div className="min-w-0">
          <p className="font-medium">Generating image...</p>
          <p className="truncate text-xs opacity-70">{prompt}</p>
        </div>
      </div>
    );
  }

  if (state.error || !state.url) {
    return (
      <div className="rounded-2xl border border-red-300/40 bg-red-50/90 p-3 text-xs text-red-700 shadow-sm dark:bg-red-950/30 dark:text-red-200">
        {state.error ?? "Image generation failed."}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(state.url!)}
      className="group block w-full overflow-hidden rounded-2xl border border-emerald-300/30 bg-black/10 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-lg"
      aria-label="Open generated image viewer"
      data-tooltip="false"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.url}
        alt={prompt}
        className="block aspect-square w-full object-cover"
        loading="lazy"
      />
      <span className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className="min-w-0 truncate opacity-80">{prompt}</span>
        <Maximize2 className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );
}

function GeneratedImageViewer({
  image,
  onClose,
}: {
  image: OpenImage;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Generated image viewer"
      data-tooltip="false"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-medium">{image.prompt}</p>
          <div className="flex items-center gap-2">
            <IconButton label="Zoom out" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>
              <Minus className="h-4 w-4" />
            </IconButton>
            <span className="w-14 text-center text-xs tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>
              <Plus className="h-4 w-4" />
            </IconButton>
            <a
              href={image.url}
              download="tradx-ai-image.png"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-emerald-500"
              aria-label="Download generated image"
              data-tooltip="false"
            >
              <Download className="h-4 w-4" />
            </a>
            <IconButton label="Close viewer" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_55%)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt}
            className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl transition-transform"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors",
        "hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      )}
      aria-label={label}
      data-tooltip="false"
    >
      {children}
    </button>
  );
}

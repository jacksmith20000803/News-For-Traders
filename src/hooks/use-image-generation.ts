"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateImage } from "@/app/actions/generate-image";

export type ImageGenerationState = {
  url: string | null;
  error: string | null;
  loading: boolean;
};

export type ImageGenerationMap = Record<string, ImageGenerationState>;

const IMAGE_CACHE_KEY = "tradx-ai-generated-images-v1";
const MAX_CACHED_IMAGES = 80;

function dedupePrompts(prompts: string[]) {
  return Array.from(new Set(prompts.map((prompt) => prompt.trim()).filter(Boolean)));
}

type CachedImage = {
  prompt: string;
  url: string;
  createdAt: number;
};

function readImageCache(): Record<string, CachedImage> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IMAGE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, CachedImage>;
  } catch {
    return {};
  }
}

function getCachedImage(prompt: string) {
  const item = readImageCache()[prompt];
  return item?.url && item.prompt === prompt ? item.url : null;
}

function writeCachedImage(prompt: string, url: string) {
  if (typeof window === "undefined" || !url) return;
  try {
    const cache = readImageCache();
    cache[prompt] = { prompt, url, createdAt: Date.now() };
    const entries = Object.entries(cache)
      .sort(([, a], [, b]) => b.createdAt - a.createdAt)
      .slice(0, MAX_CACHED_IMAGES);
    window.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage can be unavailable in private mode; image generation should still work.
  }
}

function withClientTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Image generation is taking too long. Please try again."));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function useImageGeneration(prompts: string[]): ImageGenerationMap {
  const uniquePrompts = useMemo(() => dedupePrompts(prompts), [prompts]);
  const requestedPromptsRef = useRef<Set<string>>(new Set());
  const [results, setResults] = useState<ImageGenerationMap>({});

  useEffect(() => {
    const cachedResults: ImageGenerationMap = {};
    const promptsToGenerate = uniquePrompts.filter((prompt) => {
      const cachedUrl = getCachedImage(prompt);
      if (cachedUrl) {
        cachedResults[prompt] = { url: cachedUrl, error: null, loading: false };
        requestedPromptsRef.current.add(prompt);
        return false;
      }
      return !requestedPromptsRef.current.has(prompt);
    });

    if (promptsToGenerate.length === 0) {
      setResults((current) => {
        const next: ImageGenerationMap = {};
        for (const prompt of uniquePrompts) {
          next[prompt] =
            cachedResults[prompt] ??
            current[prompt] ??
            { url: null, error: null, loading: false };
        }
        return next;
      });
      return;
    }

    for (const prompt of promptsToGenerate) {
      requestedPromptsRef.current.add(prompt);
    }

    let cancelled = false;

    setResults((current) => {
      const next: ImageGenerationMap = {};
      for (const prompt of uniquePrompts) {
        next[prompt] =
          cachedResults[prompt] ??
          current[prompt] ??
          (promptsToGenerate.includes(prompt)
            ? { url: null, error: null, loading: true }
            : { url: null, error: null, loading: false });
      }
      return next;
    });

    void Promise.allSettled(
      promptsToGenerate.map(async (prompt) => {
        const result = await withClientTimeout(generateImage(prompt), 70_000);
        return { prompt, result };
      })
    ).then((settled) => {
      if (cancelled) return;

      setResults((current) => {
        const next = { ...current };
        for (const item of settled) {
          if (item.status === "fulfilled") {
            if (item.value.result.url) {
              writeCachedImage(item.value.prompt, item.value.result.url);
            }
            next[item.value.prompt] = {
              url: item.value.result.url,
              error: item.value.result.error,
              loading: false,
            };
          } else {
            const prompt = promptsToGenerate[settled.indexOf(item)] ?? "";
            if (prompt) {
              next[prompt] = {
                url: null,
                error:
                  item.reason instanceof Error
                    ? item.reason.message
                    : "Image generation failed.",
                loading: false,
              };
            }
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [uniquePrompts]);

  return results;
}

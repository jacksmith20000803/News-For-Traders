"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateImage } from "@/app/actions/generate-image";

export type ImageGenerationState = {
  url: string | null;
  error: string | null;
  loading: boolean;
};

export type ImageGenerationMap = Record<string, ImageGenerationState>;

function dedupePrompts(prompts: string[]) {
  return Array.from(new Set(prompts.map((prompt) => prompt.trim()).filter(Boolean)));
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
    const promptsToGenerate = uniquePrompts.filter(
      (prompt) => !requestedPromptsRef.current.has(prompt)
    );

    if (promptsToGenerate.length === 0) {
      setResults((current) => {
        const next: ImageGenerationMap = {};
        for (const prompt of uniquePrompts) {
          next[prompt] = current[prompt] ?? { url: null, error: null, loading: false };
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

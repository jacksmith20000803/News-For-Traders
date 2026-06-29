"use server";

import { headers } from "next/headers";
import { ApiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { generateImageWithManagedPuterTokens } from "@/lib/puter/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type GenerateImageResult = {
  url: string | null;
  error: string | null;
};

function readIpFromHeaders(headersList: Headers) {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headersList.get("x-real-ip") ?? "127.0.0.1";
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    return { url: null, error: "Image prompt is required." };
  }

  if (trimmedPrompt.length > 1500) {
    return { url: null, error: "Image prompt is too long. Please keep it under 1,500 characters." };
  }

  const headersList = await headers();
  const user = await getCurrentUser().catch(() => null);
  const ip = readIpFromHeaders(headersList);
  const rateLimit = checkRateLimit(`ai-image:${user?.id ?? ip}`, 6, 10 * 60_000);

  if (!rateLimit.success) {
    return { url: null, error: "Too many image requests. Please wait a few minutes and try again." };
  }

  try {
    const result = await generateImageWithManagedPuterTokens(trimmedPrompt);
    return { url: result.url, error: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { url: null, error: error.message };
    }

    const message = error instanceof Error ? error.message : "Image generation failed.";
    return { url: null, error: message };
  }
}

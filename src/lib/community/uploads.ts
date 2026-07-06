import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api/response";

export const MAX_COMMUNITY_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const CHAT_ATTACHMENT_TYPES = new Set([
  ...IMAGE_TYPES,
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
]);

export async function saveCommunityImage(file: File, folder: "avatars" | "badges") {
  return saveUpload(file, {
    folder: `community/${folder}`,
    maxSize: MAX_COMMUNITY_IMAGE_SIZE_BYTES,
    allowedTypes: IMAGE_TYPES,
    typeError: "Upload a PNG, JPG, WEBP, or GIF image.",
    sizeError: "Community images must be smaller than 2MB.",
  });
}

export async function saveChatAttachment(file: File) {
  return saveUpload(file, {
    folder: "community/attachments",
    maxSize: MAX_CHAT_ATTACHMENT_SIZE_BYTES,
    allowedTypes: CHAT_ATTACHMENT_TYPES,
    typeError: "Upload an image, text, JSON, CSV, Markdown, or PDF file.",
    sizeError: "Message attachments must be smaller than 5MB.",
  });
}

async function saveUpload(
  file: File,
  options: {
    folder: string;
    maxSize: number;
    allowedTypes: Set<string>;
    typeError: string;
    sizeError: string;
  }
) {
  const contentType = file.type || inferMimeType(file.name);

  if (!options.allowedTypes.has(contentType)) {
    throw new ApiError(422, options.typeError, "INVALID_UPLOAD_TYPE");
  }

  if (file.size > options.maxSize) {
    throw new ApiError(422, options.sizeError, "UPLOAD_TOO_LARGE");
  }

  const extension = getSafeExtension(file.name, contentType);
  const fileName = `${randomUUID()}${extension}`;
  const relativeFolder = path.join("uploads", options.folder);
  const publicDir = path.join(process.cwd(), "public", relativeFolder);
  await mkdir(publicDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(publicDir, fileName), Buffer.from(bytes));

  return {
    url: `/${relativeFolder.replaceAll(path.sep, "/")}/${fileName}`,
    name: file.name || "attachment",
    type: contentType,
    size: file.size,
  };
}

function getSafeExtension(fileName: string, contentType: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(extension)) return extension;
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "application/json") return ".json";
  if (contentType === "application/pdf") return ".pdf";
  if (contentType === "text/csv") return ".csv";
  if (contentType === "text/markdown") return ".md";
  return ".txt";
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

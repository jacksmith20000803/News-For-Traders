import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import {
  addCommunityMediaItem,
  deleteCommunityMediaItems,
  getCommunityMediaCatalog,
} from "@/lib/community/media";
import { saveCommunityMediaAsset } from "@/lib/community/uploads";
import type { CommunityMediaType } from "@/lib/community/media-types";

const mediaQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: z.enum(["ALL", "EMOJI", "STICKER", "GIF"]).default("ALL"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

const deleteSchema = z
  .object({
    ids: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
    q: z.string().trim().optional(),
    type: z.enum(["ALL", "EMOJI", "STICKER", "GIF"]).default("ALL"),
  })
  .refine((data) => data.all || (data.ids && data.ids.length > 0), "Select media to delete.");

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const params = mediaQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? "ALL",
      cursor: request.nextUrl.searchParams.get("cursor") ?? 0,
      limit: request.nextUrl.searchParams.get("limit") ?? 24,
    });
    const query = params.q?.toLowerCase();
    const catalog = await getCommunityMediaCatalog();
    const filtered = catalog.filter((item) => {
      if (params.type !== "ALL" && item.type !== params.type) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.value?.includes(query);
    });
    const items = filtered.slice(params.cursor, params.cursor + params.limit);

    return apiSuccess({
      items,
      nextCursor: params.cursor + items.length,
      hasMore: params.cursor + items.length < filtered.length,
      total: filtered.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireAdmin();
    const formData = await request.formData();
    const type = String(formData.get("type") ?? "") as CommunityMediaType;
    const name = String(formData.get("name") ?? "").trim();
    const value = String(formData.get("value") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const file = formData.get("file");

    if (!["EMOJI", "STICKER", "GIF"].includes(type)) {
      throw new ApiError(422, "Choose a valid media type.", "INVALID_MEDIA_TYPE");
    }
    if (!name) throw new ApiError(422, "A media name is required.", "MEDIA_NAME_REQUIRED");

    if (type === "EMOJI") {
      if (!value) throw new ApiError(422, "An emoji value is required.", "EMOJI_VALUE_REQUIRED");
      const item = await addCommunityMediaItem({ type, name, value });
      return apiSuccess({ item }, 201);
    }

    let assetUrl = url;
    if (file instanceof File && file.size > 0) {
      const saved = await saveCommunityMediaAsset(file, type);
      assetUrl = saved.url;
    }
    if (!assetUrl) throw new ApiError(422, "Upload a file or provide an asset URL.", "MEDIA_URL_REQUIRED");

    const item = await addCommunityMediaItem({ type, name, url: assetUrl });
    return apiSuccess({ item }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireAdmin();
    const data = deleteSchema.parse(await parseJsonBody(request));
    const ids = data.all ? matchingMediaIds(await getCommunityMediaCatalog(), data.q, data.type) : (data.ids ?? []);
    const deleted = await deleteCommunityMediaItems(ids);
    return apiSuccess({ deleted });
  } catch (error) {
    return handleApiError(error);
  }
}

function matchingMediaIds(items: Awaited<ReturnType<typeof getCommunityMediaCatalog>>, query: string | undefined, type: "ALL" | CommunityMediaType) {
  const normalizedQuery = query?.toLowerCase();
  return items
    .filter((item) => {
      if (type !== "ALL" && item.type !== type) return false;
      if (!normalizedQuery) return true;
      return item.name.toLowerCase().includes(normalizedQuery) || item.value?.includes(normalizedQuery);
    })
    .map((item) => item.id);
}

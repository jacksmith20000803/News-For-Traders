import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth, requireVerifiedEmail, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isCommunityPresetAsset } from "@/lib/community/presets";
import { saveCommunityImage } from "@/lib/community/uploads";
import { slugify } from "@/lib/utils";
import { createNotification } from "@/lib/notifications";

const createCommunitySchema = z.object({
  name: z.string().trim().min(3, "Community name must be at least 3 characters.").max(64),
  topic: z.string().trim().min(10, "Topic must be at least 10 characters.").max(220),
  rules: z.string().trim().min(20, "Rules must be at least 20 characters.").max(4000),
  avatarPreset: z.string().trim().optional(),
  badgePreset: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const communities = await db.tradeCommunity.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { topic: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true, username: true, avatar: true } },
        _count: { select: { members: true, messages: true } },
      },
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      take: 48,
    });

    return apiSuccess({
      communities: communities.map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        topic: community.topic,
        rules: community.rules,
        avatarUrl: community.avatarUrl,
        badgeUrl: community.badgeUrl,
        owner: community.owner,
        memberCount: community._count.members,
        messageCount: community._count.messages,
        approvedAt: community.approvedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireVerifiedEmail();
    const formData = await request.formData();
    const data = createCommunitySchema.parse({
      name: String(formData.get("name") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      rules: String(formData.get("rules") ?? ""),
      avatarPreset: String(formData.get("avatarPreset") ?? "") || undefined,
      badgePreset: String(formData.get("badgePreset") ?? "") || undefined,
    });

    const avatarFile = formData.get("avatar");
    const badgeFile = formData.get("badge");
    const avatarUrl = await resolveCommunityAsset({
      file: avatarFile,
      preset: data.avatarPreset,
      kind: "avatar",
    });
    const badgeUrl = await resolveCommunityAsset({
      file: badgeFile,
      preset: data.badgePreset,
      kind: "badge",
    });
    const slug = await createUniqueCommunitySlug(data.name);

    const community = await db.$transaction(async (tx) => {
      const created = await tx.tradeCommunity.create({
        data: {
          name: data.name,
          slug,
          topic: data.topic,
          rules: data.rules,
          avatarUrl,
          badgeUrl,
          ownerId: user.id,
          status: "PENDING",
        },
      });

      await tx.communityMembership.create({
        data: {
          communityId: created.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
          rulesAgreedAt: new Date(),
        },
      });

      return created;
    });

    const admins = await db.user.findMany({
      where: { role: "ADMIN", deletedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "SYSTEM",
          title: "Community approval request",
          message: `${user.name} requested approval for ${community.name}.`,
          metadata: { communityId: community.id },
        })
      )
    );

    return apiSuccess(
      {
        community: {
          id: community.id,
          name: community.name,
          slug: community.slug,
          status: community.status,
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

async function resolveCommunityAsset({
  file,
  preset,
  kind,
}: {
  file: FormDataEntryValue | null;
  preset?: string;
  kind: "avatar" | "badge";
}) {
  if (file instanceof File && file.size > 0) {
    const saved = await saveCommunityImage(file, kind === "avatar" ? "avatars" : "badges");
    return saved.url;
  }

  if (preset && isCommunityPresetAsset(preset, kind)) {
    return preset;
  }

  if (preset) {
    throw new ApiError(422, "Unsupported community asset preset.", "INVALID_PRESET");
  }

  return kind === "avatar" ? "/coin-avatar/btc.webp" : "/coin-backgrounds/btc.webp";
}

async function createUniqueCommunitySlug(name: string) {
  const base = slugify(name) || "community";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Date.now().toString(36)}-${attempt}`;
    const slug = `${base}${suffix}`;
    const existing = await db.tradeCommunity.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

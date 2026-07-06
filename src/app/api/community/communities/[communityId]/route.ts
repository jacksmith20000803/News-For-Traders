import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const updateCommunitySchema = z.object({
  name: z.string().trim().min(3).max(64).optional(),
  topic: z.string().trim().min(10).max(220).optional(),
  rules: z.string().trim().min(20).max(4000).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const user = await requireAuth();
    const { communityId } = await params;
    const community = await db.tradeCommunity.findFirst({
      where: { id: communityId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, username: true, avatar: true } },
        members: {
          where: { userId: user.id },
          select: { id: true, role: true, status: true, rulesAgreedAt: true },
        },
        _count: { select: { members: true, messages: true } },
      },
    });
    if (!community) throw new ApiError(404, "Community not found.", "COMMUNITY_NOT_FOUND");
    if (community.status !== "APPROVED" && community.ownerId !== user.id) {
      throw new ApiError(404, "Community not found.", "COMMUNITY_NOT_FOUND");
    }

    return apiSuccess({
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        topic: community.topic,
        rules: community.rules,
        avatarUrl: community.avatarUrl,
        badgeUrl: community.badgeUrl,
        ownerId: community.ownerId,
        status: community.status,
        owner: community.owner,
        memberCount: community._count.members,
        messageCount: community._count.messages,
        membership: community.members[0]
          ? {
              ...community.members[0],
              rulesAgreedAt: community.members[0].rulesAgreedAt?.toISOString() ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { communityId } = await params;
    await requireOwner(communityId, user.id);
    const data = updateCommunitySchema.parse(await parseJsonBody(request));

    const updated = await db.tradeCommunity.update({
      where: { id: communityId },
      data,
    });

    return apiSuccess({
      community: {
        id: updated.id,
        name: updated.name,
        topic: updated.topic,
        rules: updated.rules,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { communityId } = await params;
    await requireOwner(communityId, user.id);

    await db.tradeCommunity.update({
      where: { id: communityId },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });

    return apiSuccess({ deleted: true, id: communityId });
  } catch (error) {
    return handleApiError(error);
  }
}

async function requireOwner(communityId: string, userId: string) {
  const membership = await db.communityMembership.findFirst({
    where: {
      communityId,
      userId,
      role: "OWNER",
      status: "ACTIVE",
      community: { deletedAt: null },
    },
    select: { id: true },
  });
  if (!membership) throw new ApiError(403, "Only the community creator can manage this community.", "OWNER_REQUIRED");
}

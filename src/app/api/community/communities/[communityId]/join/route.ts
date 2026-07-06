import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, ApiError } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { communityId } = await params;

    const community = await db.tradeCommunity.findFirst({
      where: { id: communityId, status: "APPROVED", deletedAt: null },
      select: { id: true },
    });
    if (!community) throw new ApiError(404, "Community not found.", "COMMUNITY_NOT_FOUND");

    const existing = await db.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId: user.id } },
    });
    if (existing?.status === "BLOCKED") {
      throw new ApiError(403, "You are blocked from this community.", "COMMUNITY_BLOCKED");
    }

    const membership = await db.communityMembership.upsert({
      where: { communityId_userId: { communityId, userId: user.id } },
      create: {
        communityId,
        userId: user.id,
        role: "MEMBER",
        status: "ACTIVE",
        rulesAgreedAt: new Date(),
      },
      update: {
        status: "ACTIVE",
        rulesAgreedAt: new Date(),
        blockedAt: null,
        blockedReason: null,
      },
    });

    return apiSuccess({
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        rulesAgreedAt: membership.rulesAgreedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

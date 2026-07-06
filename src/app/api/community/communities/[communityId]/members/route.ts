import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const memberActionSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["block", "unblock", "remove"]),
  reason: z.string().trim().max(500).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const user = await requireAuth();
    const { communityId } = await params;
    await requireCommunityAccess(communityId, user.id);

    const members = await db.communityMembership.findMany({
      where: { communityId, status: { in: ["ACTIVE", "BLOCKED"] } },
      include: {
        user: { select: { id: true, name: true, username: true, email: true, avatar: true, country: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    return apiSuccess({
      members: members.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        rulesAgreedAt: member.rulesAgreedAt?.toISOString() ?? null,
        blockedReason: member.blockedReason,
        user: member.user,
      })),
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
    const data = memberActionSchema.parse(await parseJsonBody(request));
    await requireCommunityOwner(communityId, user.id);

    const target = await db.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId: data.userId } },
      select: { id: true, role: true },
    });
    if (!target) throw new ApiError(404, "Member not found.", "MEMBER_NOT_FOUND");
    if (target.role === "OWNER") throw new ApiError(403, "The owner cannot be removed or blocked.", "OWNER_LOCKED");

    const membership = await db.communityMembership.update({
      where: { id: target.id },
      data:
        data.action === "block"
          ? {
              status: "BLOCKED",
              blockedAt: new Date(),
              blockedReason: data.reason || "Blocked by community owner.",
            }
          : data.action === "unblock"
            ? { status: "ACTIVE", blockedAt: null, blockedReason: null }
            : { status: "REMOVED", blockedAt: null, blockedReason: data.reason || "Removed by community owner." },
    });

    return apiSuccess({
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        blockedReason: membership.blockedReason,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function requireCommunityAccess(communityId: string, userId: string) {
  const membership = await db.communityMembership.findFirst({
    where: {
      communityId,
      userId,
      status: { in: ["ACTIVE", "BLOCKED"] },
      community: { deletedAt: null },
    },
    select: { id: true },
  });
  if (!membership) throw new ApiError(403, "Community access required.", "COMMUNITY_ACCESS_REQUIRED");
}

async function requireCommunityOwner(communityId: string, userId: string) {
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
  if (!membership) throw new ApiError(403, "Only the community creator can manage members.", "OWNER_REQUIRED");
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const communityAdminQuerySchema = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"]).default("PENDING"),
  q: z.string().trim().optional(),
});

const communityAdminActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  action: z.enum(["approve", "reject", "archive"]),
  reason: z.string().trim().max(600).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const params = communityAdminQuerySchema.parse({
      status: request.nextUrl.searchParams.get("status") ?? "PENDING",
      q: request.nextUrl.searchParams.get("q") ?? undefined,
    });

    const communities = await db.tradeCommunity.findMany({
      where: {
        ...(params.status !== "ALL" ? { status: params.status } : {}),
        ...(params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { topic: { contains: params.q, mode: "insensitive" } },
                { owner: { name: { contains: params.q, mode: "insensitive" } } },
                { owner: { email: { contains: params.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            country: true,
          },
        },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess({
      items: communities.map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        topic: community.topic,
        rules: community.rules,
        avatarUrl: community.avatarUrl,
        badgeUrl: community.badgeUrl,
        status: community.status,
        rejectionReason: community.rejectionReason,
        owner: community.owner,
        approvedBy: community.approvedBy,
        memberCount: community._count.members,
        messageCount: community._count.messages,
        createdAt: community.createdAt.toISOString(),
        approvedAt: community.approvedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const data = communityAdminActionSchema.parse(await parseJsonBody(request));
    if (data.action !== "approve" && !data.reason) {
      throw new ApiError(422, "A reason is required.", "REASON_REQUIRED");
    }

    const communities = await db.tradeCommunity.findMany({
      where: { id: { in: data.ids } },
      select: { id: true, ownerId: true, name: true },
    });
    if (!communities.length) throw new ApiError(404, "No communities found.", "COMMUNITY_NOT_FOUND");

    const nextStatus =
      data.action === "approve" ? "APPROVED" : data.action === "reject" ? "REJECTED" : "ARCHIVED";

    await db.tradeCommunity.updateMany({
      where: { id: { in: communities.map((community) => community.id) } },
      data: {
        status: nextStatus,
        rejectionReason: data.action === "approve" ? null : data.reason,
        approvedById: data.action === "approve" ? admin.id : null,
        approvedAt: data.action === "approve" ? new Date() : null,
        deletedAt: data.action === "archive" ? new Date() : null,
      },
    });

    await Promise.all(
      communities.map((community) =>
        createNotification({
          userId: community.ownerId,
          type: "MODERATION",
          title:
            data.action === "approve"
              ? "Community approved"
              : data.action === "reject"
                ? "Community request rejected"
                : "Community archived",
          message:
            data.action === "approve"
              ? `${community.name} is now live.`
              : `${community.name}: ${data.reason}`,
          metadata: { communityId: community.id },
        })
      )
    );

    return apiSuccess({ updated: communities.length });
  } catch (error) {
    return handleApiError(error);
  }
}

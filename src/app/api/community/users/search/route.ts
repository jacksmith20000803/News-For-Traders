import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return apiSuccess({ users: [] });

    const users = await db.user.findMany({
      where: {
        id: { not: user.id },
        deletedAt: null,
        isBanned: false,
        isSuspended: false,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        country: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const userIds = users.map((item) => item.id);
    const [requestsFromMe, requestsToMe] = await Promise.all([
      db.friendRequest.findMany({
        where: { requesterId: user.id, recipientId: { in: userIds } },
        select: { recipientId: true, status: true },
      }),
      db.friendRequest.findMany({
        where: { recipientId: user.id, requesterId: { in: userIds } },
        select: { requesterId: true, status: true },
      }),
    ]);
    const outgoing = new Map(requestsFromMe.map((request) => [request.recipientId, request.status]));
    const incoming = new Map(requestsToMe.map((request) => [request.requesterId, request.status]));

    return apiSuccess({
      users: users.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        outgoingFriendStatus: outgoing.get(item.id) ?? null,
        incomingFriendStatus: incoming.get(item.id) ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

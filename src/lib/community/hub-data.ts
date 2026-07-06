import "server-only";

import { db } from "@/lib/db";

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatar: true,
  country: true,
} as const;

export async function getCommunityHubData(userId: string) {
  const [memberships, discoverCommunities, dmConversations, incomingFriendRequests, outgoingFriendRequests] =
    await Promise.all([
      db.communityMembership.findMany({
        where: {
          userId,
          status: { in: ["ACTIVE", "BLOCKED"] },
          community: {
            deletedAt: null,
            status: { in: ["APPROVED", "PENDING"] },
          },
        },
        include: {
          community: {
            include: {
              owner: { select: userSelect },
              _count: { select: { members: true, messages: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.tradeCommunity.findMany({
        where: {
          status: "APPROVED",
          deletedAt: null,
          members: { none: { userId } },
        },
        include: {
          owner: { select: userSelect },
          _count: { select: { members: true, messages: true } },
        },
        orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
        take: 24,
      }),
      db.directConversation.findMany({
        where: {
          participants: { some: { userId } },
        },
        include: {
          participants: {
            include: { user: { select: userSelect } },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      db.friendRequest.findMany({
        where: { recipientId: userId, status: "PENDING" },
        include: { requester: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.friendRequest.findMany({
        where: { requesterId: userId, status: "PENDING" },
        include: { recipient: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  return {
    myCommunities: memberships.map((membership) => ({
      id: membership.community.id,
      name: membership.community.name,
      slug: membership.community.slug,
      topic: membership.community.topic,
      rules: membership.community.rules,
      avatarUrl: membership.community.avatarUrl,
      badgeUrl: membership.community.badgeUrl,
      status: membership.community.status,
      ownerId: membership.community.ownerId,
      owner: membership.community.owner,
      memberCount: membership.community._count.members,
      messageCount: membership.community._count.messages,
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        rulesAgreedAt: membership.rulesAgreedAt?.toISOString() ?? null,
      },
      createdAt: membership.community.createdAt.toISOString(),
      updatedAt: membership.community.updatedAt.toISOString(),
    })),
    discoverCommunities: discoverCommunities.map((community) => ({
      id: community.id,
      name: community.name,
      slug: community.slug,
      topic: community.topic,
      rules: community.rules,
      avatarUrl: community.avatarUrl,
      badgeUrl: community.badgeUrl,
      status: community.status,
      ownerId: community.ownerId,
      owner: community.owner,
      memberCount: community._count.members,
      messageCount: community._count.messages,
      createdAt: community.createdAt.toISOString(),
      approvedAt: community.approvedAt?.toISOString() ?? null,
    })),
    dmConversations: dmConversations.map((conversation) => {
      const otherParticipant = conversation.participants.find((participant) => participant.userId !== userId);
      const latestMessage = conversation.messages[0] ?? null;
      return {
        id: conversation.id,
        otherUser: otherParticipant?.user ?? conversation.participants[0]?.user ?? null,
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              content: latestMessage.content,
              attachmentName: latestMessage.attachmentName,
              createdAt: latestMessage.createdAt.toISOString(),
            }
          : null,
        updatedAt: conversation.updatedAt.toISOString(),
      };
    }),
    incomingFriendRequests: incomingFriendRequests.map((request) => ({
      id: request.id,
      requester: request.requester,
      createdAt: request.createdAt.toISOString(),
    })),
    outgoingFriendRequests: outgoingFriendRequests.map((request) => ({
      id: request.id,
      recipient: request.recipient,
      createdAt: request.createdAt.toISOString(),
    })),
  };
}

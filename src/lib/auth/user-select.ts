import type { Prisma } from "@prisma/client";

/** Fields safe to return in API responses — never includes secrets. */
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  bio: true,
  reputation: true,
  contributionCount: true,
  emailVerified: true,
  isSuspended: true,
  isBanned: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

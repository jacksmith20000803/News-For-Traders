import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? 15)));
    const q = searchParams.get("q")?.trim();
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { username: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          passwordHash: true,
          role: true,
          reputation: true,
          isSuspended: true,
          isBanned: true,
          createdAt: true,
          registrationAudit: {
            select: {
              browser: true,
              deviceType: true,
              os: true,
              userAgent: true,
              registeredAt: true,
            },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return apiSuccess({
      users: users.map(({ passwordHash, ...user }) => ({
        ...user,
        passwordSet: Boolean(passwordHash),
        createdAt: user.createdAt.toISOString(),
        registrationAudit: user.registrationAudit
          ? {
              ...user.registrationAudit,
              registeredAt: user.registrationAudit.registeredAt.toISOString(),
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

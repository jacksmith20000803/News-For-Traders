import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? 15)));
    const kind = searchParams.get("kind") === "visitors" ? "visitors" : "users";
    const q = searchParams.get("q")?.trim();
    const skip = (page - 1) * limit;

    if (kind === "visitors") {
      const where = {
        userId: null,
        ...(q
          ? {
              OR: [
                { visitorId: { contains: q, mode: "insensitive" as const } },
                { country: { contains: q, mode: "insensitive" as const } },
                { region: { contains: q, mode: "insensitive" as const } },
                { city: { contains: q, mode: "insensitive" as const } },
                { browser: { contains: q, mode: "insensitive" as const } },
                { os: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [groups, totalGroups] = await Promise.all([
        db.visitorActivity.groupBy({
          by: ["visitorId"],
          where,
          _max: { createdAt: true },
          _min: { createdAt: true },
          _count: { _all: true },
          orderBy: { _max: { createdAt: "desc" } },
          skip,
          take: limit,
        }),
        db.visitorActivity.groupBy({
          by: ["visitorId"],
          where,
          _count: { _all: true },
        }),
      ]);

      const visitors = await Promise.all(
        groups.map(async (group) => {
          const latest = await db.visitorActivity.findFirst({
            where: { visitorId: group.visitorId },
            orderBy: { createdAt: "desc" },
          });

          return {
            id: group.visitorId,
            visitorId: group.visitorId,
            email: null,
            username: "Visitor",
            name: "Unregistered visitor",
            avatar: null,
            location: {
              country: latest?.country ?? null,
              region: latest?.region ?? null,
              city: latest?.city ?? null,
              timezone: latest?.timezone ?? null,
            },
            device: {
              browser: latest?.browser ?? null,
              os: latest?.os ?? null,
              deviceType: latest?.deviceType ?? null,
              userAgent: latest?.userAgent ?? null,
            },
            ipAddress: latest?.ipAddress ?? null,
            firstSeenAt: group._min.createdAt?.toISOString() ?? latest?.createdAt.toISOString() ?? null,
            lastSeenAt: latest?.createdAt.toISOString() ?? null,
            activityCount: group._count._all,
          };
        })
      );

      return apiSuccess({
        kind,
        visitors,
        users: [],
        pagination: {
          page,
          limit,
          total: totalGroups.length,
          totalPages: Math.max(1, Math.ceil(totalGroups.length / limit)),
        },
      });
    }

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
          avatar: true,
          country: true,
          timezone: true,
          bio: true,
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
              ipAddress: true,
              country: true,
              city: true,
              registeredAt: true,
            },
          },
          sessions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, ipAddress: true, userAgent: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return apiSuccess({
      kind,
      visitors: [],
      users: users.map(({ passwordHash, ...user }) => ({
        ...user,
        passwordSet: Boolean(passwordHash),
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.sessions[0]?.createdAt.toISOString() ?? null,
        sessions: undefined,
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

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = await parseJsonBody(request);
    const kind = body && typeof body === "object" && "kind" in body && body.kind === "visitors" ? "visitors" : "users";
    const ids =
      body && typeof body === "object" && "ids" in body && Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

    if (ids.length === 0) {
      return apiError("At least one record must be selected.", 422, "NO_RECORDS_SELECTED");
    }

    const uniqueIds = Array.from(new Set(ids)).slice(0, 100);

    if (kind === "visitors") {
      const result = await db.visitorActivity.deleteMany({
        where: { visitorId: { in: uniqueIds } },
      });
      await logAuditEvent({
        adminId: admin.id,
        action: "SETTINGS_UPDATE",
        targetType: "visitor",
        targetId: uniqueIds.join(","),
        metadata: { action: "bulk_delete_visitors", count: result.count },
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      });
      return apiSuccess({ deleted: result.count, message: `Deleted ${result.count} visitor activity records.` });
    }

    const deletableIds = uniqueIds.filter((id) => id !== admin.id);
    if (deletableIds.length === 0) {
      return apiError("You cannot delete your own admin account.", 403, "CANNOT_DELETE_SELF");
    }

    const result = await db.user.updateMany({
      where: { id: { in: deletableIds }, deletedAt: null },
      data: { deletedAt: new Date(), isBanned: true },
    });

    await db.session.deleteMany({ where: { userId: { in: deletableIds } } });
    await logAuditEvent({
      adminId: admin.id,
      action: "USER_BAN",
      targetType: "user",
      targetId: deletableIds.join(","),
      metadata: { deleted: true, bulk: true, count: result.count },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return apiSuccess({ deleted: result.count, message: `Deleted ${result.count} account${result.count === 1 ? "" : "s"}.` });
  } catch (error) {
    return handleApiError(error);
  }
}

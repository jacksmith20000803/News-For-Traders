import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseDateRange(date: string | null) {
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const start = new Date(`${selected}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { selected, start, end };
}

function activityDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") === "visitor" ? "visitor" : "user";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(10, Number(searchParams.get("limit") ?? 20)));
    const skip = (page - 1) * limit;
    const { selected, start, end } = parseDateRange(searchParams.get("date"));

    if (kind === "visitor") {
      const visitorId = decodeURIComponent(id);
      const latest = await db.visitorActivity.findFirst({
        where: { visitorId },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) return apiError("Visitor not found", 404, "VISITOR_NOT_FOUND");

      const [activity, totalActivity, dateRows] = await Promise.all([
        db.visitorActivity.findMany({
          where: { visitorId, createdAt: { gte: start, lt: end } },
          orderBy: { createdAt: "asc" },
          skip,
          take: limit,
        }),
        db.visitorActivity.count({
          where: { visitorId, createdAt: { gte: start, lt: end } },
        }),
        db.visitorActivity.findMany({
          where: { visitorId },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: { createdAt: true },
        }),
      ]);

      return apiSuccess({
        kind,
        profile: {
          id: visitorId,
          visitorId,
          name: "Unregistered visitor",
          username: "Visitor",
          email: null,
          avatar: null,
          passwordStatus: "No registered account",
          role: "GUEST",
          createdAt: null,
          lastLoginAt: null,
        },
        details: {
          dateOfBirth: null,
          bio: null,
          interests: [],
          feedback: [],
          location: {
            country: latest.country,
            region: latest.region,
            city: latest.city,
            timezone: latest.timezone,
          },
          device: {
            browser: latest.browser,
            os: latest.os,
            deviceType: latest.deviceType,
            userAgent: latest.userAgent,
            ipAddress: latest.ipAddress,
          },
          sessions: [],
        },
        activity: {
          selectedDate: selected,
          activeDates: Array.from(new Set(dateRows.map((row) => activityDate(row.createdAt)))),
          items: activity.map((item) => serializeActivity(item)),
          pagination: {
            page,
            limit,
            total: totalActivity,
            totalPages: Math.max(1, Math.ceil(totalActivity / limit)),
          },
        },
      });
    }

    const user = await db.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        registrationAudit: true,
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        interests: true,
        feedbackSubmissions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) return apiError("User not found", 404, "USER_NOT_FOUND");

    const [activity, totalActivity, dateRows] = await Promise.all([
      db.visitorActivity.findMany({
        where: { userId: user.id, createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      db.visitorActivity.count({
        where: { userId: user.id, createdAt: { gte: start, lt: end } },
      }),
      db.visitorActivity.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: { createdAt: true },
      }),
    ]);

    const latestSession = user.sessions[0] ?? null;

    return apiSuccess({
      kind,
      profile: {
        id: user.id,
        visitorId: null,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        passwordStatus: user.passwordHash
          ? "Password is securely hashed. Use reset to change it."
          : "No password set",
        role: user.role,
        reputation: user.reputation,
        contributionCount: user.contributionCount,
        isSuspended: user.isSuspended,
        isBanned: user.isBanned,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: latestSession?.createdAt.toISOString() ?? null,
      },
      details: {
        dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
        bio: user.bio,
        interests: user.interests.map((interest) => interest.category),
        feedback: user.feedbackSubmissions.map((feedback) => ({
          id: feedback.id,
          type: feedback.type,
          subject: feedback.subject,
          message: feedback.message,
          status: feedback.status,
          createdAt: feedback.createdAt.toISOString(),
        })),
        location: {
          country: user.country ?? user.registrationAudit?.country ?? null,
          region: null,
          city: user.registrationAudit?.city ?? null,
          timezone: user.timezone,
        },
        device: {
          browser: user.registrationAudit?.browser ?? null,
          os: user.registrationAudit?.os ?? null,
          deviceType: user.registrationAudit?.deviceType ?? null,
          userAgent: user.registrationAudit?.userAgent ?? latestSession?.userAgent ?? null,
          ipAddress: user.registrationAudit?.ipAddress ?? latestSession?.ipAddress ?? null,
        },
        sessions: user.sessions.map((session) => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        })),
      },
      activity: {
        selectedDate: selected,
        activeDates: Array.from(new Set(dateRows.map((row) => activityDate(row.createdAt)))),
        items: activity.map((item) => serializeActivity(item)),
        pagination: {
          page,
          limit,
          total: totalActivity,
          totalPages: Math.max(1, Math.ceil(totalActivity / limit)),
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await validateCsrf(request);
    await requireAdmin();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") === "visitor" ? "visitor" : "user";

    const result =
      kind === "visitor"
        ? await db.visitorActivity.deleteMany({ where: { visitorId: decodeURIComponent(id) } })
        : await db.visitorActivity.deleteMany({ where: { userId: id } });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

function serializeActivity(item: {
  id: string;
  action: string;
  path: string | null;
  target: string | null;
  ipAddress: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    action: item.action,
    path: item.path,
    target: item.target,
    ipAddress: item.ipAddress,
    browser: item.browser,
    os: item.os,
    deviceType: item.deviceType,
    metadata: item.metadata,
    createdAt: item.createdAt.toISOString(),
  };
}

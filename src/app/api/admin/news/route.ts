import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const page = readPositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(readPositiveInt(request.nextUrl.searchParams.get("limit"), 12), MAX_LIMIT);
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const where: Prisma.NewsWhereInput = q
      ? {
          OR: [
            { headline: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { source: { name: { contains: q, mode: "insensitive" } } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      db.news.findMany({
        where,
        include: {
          source: { select: { id: true, name: true, reliabilityScore: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.news.count({ where }),
    ]);

    return apiSuccess({
      items,
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
    const body = await parseJsonBody<{ ids?: unknown }>(request);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (!ids.length) {
      return apiError("Select at least one news item to delete.", 422, "NEWS_IDS_REQUIRED");
    }

    const result = await db.news.deleteMany({ where: { id: { in: ids } } });

    await logAuditEvent({
      adminId: admin.id,
      action: "NEWS_DELETE",
      targetType: "news",
      metadata: { ids, count: result.count },
      ipAddress: getClientIp(request),
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

function readPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

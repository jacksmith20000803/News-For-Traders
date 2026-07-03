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

    const where = buildNewsWhere(q);

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
    const body = await parseJsonBody<{ ids?: unknown; range?: unknown }>(request);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const range = parseDeleteRange(body.range);

    if (!ids.length && !range) {
      return apiError("Select at least one news item or range to delete.", 422, "NEWS_SELECTION_REQUIRED");
    }

    const deleteIds = range ? await readRangeIds(range) : ids;

    if (!deleteIds.length) {
      return apiError("No news items matched that deletion range.", 404, "NEWS_RANGE_EMPTY");
    }

    const result = await db.news.deleteMany({ where: { id: { in: deleteIds } } });

    await logAuditEvent({
      adminId: admin.id,
      action: "NEWS_DELETE",
      targetType: "news",
      metadata: { ids: deleteIds, range, count: result.count },
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

function buildNewsWhere(q?: string): Prisma.NewsWhereInput {
  const query = q?.trim();
  return query
    ? {
        OR: [
          { headline: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
          { source: { name: { contains: query, mode: "insensitive" } } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};
}

function parseDeleteRange(value: unknown): { start: number; end: number; q?: string } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { start?: unknown; end?: unknown; q?: unknown };
  const start = Number(candidate.start);
  const end = Number(candidate.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return null;
  return {
    start,
    end,
    ...(typeof candidate.q === "string" && candidate.q.trim() ? { q: candidate.q.trim() } : {}),
  };
}

async function readRangeIds(range: { start: number; end: number; q?: string }) {
  const take = range.end - range.start + 1;
  const rows = await db.news.findMany({
    where: buildNewsWhere(range.q),
    select: { id: true },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    skip: range.start - 1,
    take,
  });

  return rows.map((row) => row.id);
}

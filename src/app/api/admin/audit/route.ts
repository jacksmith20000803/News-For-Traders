import { NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";

const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const page = readPositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(readPositiveInt(request.nextUrl.searchParams.get("limit"), 20), MAX_LIMIT);
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const normalizedAction = q?.toUpperCase();
    const action = normalizedAction && isAuditAction(normalizedAction) ? normalizedAction : null;
    const where: Prisma.AuditLogWhereInput = q
      ? {
          OR: [
            ...(action ? [{ action: { equals: action } }] : []),
            { targetType: { contains: q, mode: "insensitive" } },
            { targetId: { contains: q, mode: "insensitive" } },
            { ipAddress: { contains: q, mode: "insensitive" } },
            { admin: { name: { contains: q, mode: "insensitive" } } },
            { admin: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { admin: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
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
      return apiError("Select at least one audit log to delete.", 422, "AUDIT_IDS_REQUIRED");
    }

    const result = await db.auditLog.deleteMany({ where: { id: { in: ids } } });

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "audit_log",
      metadata: { action: "audit_log_delete", ids, count: result.count },
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

function isAuditAction(value: string): value is AuditAction {
  return (Object.values(AuditAction) as string[]).includes(value);
}

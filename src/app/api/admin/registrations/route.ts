import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(50).default(12),
  q: z.string().trim().optional(),
});

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? "12",
      q: searchParams.get("q") ?? undefined,
    });

    const where: Prisma.RegistrationAuditWhereInput = params.q
      ? {
          OR: [
            { ipAddress: { contains: params.q, mode: "insensitive" } },
            { country: { contains: params.q, mode: "insensitive" } },
            { city: { contains: params.q, mode: "insensitive" } },
            { browser: { contains: params.q, mode: "insensitive" } },
            { os: { contains: params.q, mode: "insensitive" } },
            { vpnProvider: { contains: params.q, mode: "insensitive" } },
            { user: { email: { contains: params.q, mode: "insensitive" } } },
            { user: { name: { contains: params.q, mode: "insensitive" } } },
            { user: { username: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      db.registrationAudit.findMany({
        where,
        orderBy: { registeredAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          user: { select: { id: true, name: true, email: true, username: true, avatar: true, role: true } },
        },
      }),
      db.registrationAudit.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
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
    const body = deleteSchema.parse(await parseJsonBody(request));

    const result = await db.registrationAudit.deleteMany({
      where: { id: { in: body.ids } },
    });

    await logAuditEvent({
      adminId: admin.id,
      action: "CONTENT_DELETE",
      targetType: "registration_audit",
      targetId: body.ids.join(","),
      metadata: { action: "registration_audit_delete", ids: body.ids },
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

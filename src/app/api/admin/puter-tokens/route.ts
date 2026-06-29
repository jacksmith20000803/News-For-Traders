import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { ensurePuterTokenTable } from "@/lib/puter/schema";

const DEFAULT_MODELS = ["gpt-5-nano", "gpt-5-mini", "gpt-4.1-mini", "claude-sonnet-4"];

const tokenSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  token: z.string().trim().min(10).max(5000).optional(),
  selectedModels: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  requestLimit: z.coerce.number().int().min(1).max(1_000_000).default(1000),
  isActive: z.boolean().default(true),
});

const updateSchema = tokenSchema.partial().extend({
  id: z.string().cuid(),
});

function maskToken(token: string) {
  if (token.length <= 12) return `${token.slice(0, 2)}...${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function serializeToken(token: {
  id: string;
  displayName: string;
  token: string;
  selectedModels: unknown;
  requestLimit: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  isActive: boolean;
  isExhausted: boolean;
  lastUsedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...token,
    token: undefined,
    maskedToken: maskToken(token.token),
    selectedModels: Array.isArray(token.selectedModels) ? token.selectedModels : [],
    usageRate:
      token.requestLimit > 0 ? Math.min(100, Math.round((token.requestCount / token.requestLimit) * 100)) : 0,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await ensurePuterTokenTable();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(25, Math.max(5, Number(searchParams.get("limit") ?? 10)));
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      db.puterToken.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      db.puterToken.count(),
    ]);

    return apiSuccess({
      tokens: tokens.map(serializeToken),
      defaultModels: DEFAULT_MODELS,
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

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    await ensurePuterTokenTable();
    const ip = getClientIp(request);
    const data = tokenSchema.parse(await parseJsonBody(request));

    if (!data.token) return apiError("AI token is required", 422);

    const token = await db.puterToken.create({
      data: {
        displayName: data.displayName,
        token: data.token,
        selectedModels: data.selectedModels,
        requestLimit: data.requestLimit,
        isActive: data.isActive,
        createdById: admin.id,
      },
    });

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "puter_token",
      targetId: token.id,
      metadata: { action: "puter_token_create", displayName: data.displayName },
      ipAddress: ip,
    });

    return apiSuccess(serializeToken(token), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    await ensurePuterTokenTable();
    const ip = getClientIp(request);
    const data = updateSchema.parse(await parseJsonBody(request));
    const { id, token, ...rest } = data;

    const updated = await db.puterToken.update({
      where: { id },
      data: {
        ...rest,
        ...(token ? { token, isExhausted: false, lastError: null } : {}),
      },
    });

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "puter_token",
      targetId: id,
      metadata: { action: "puter_token_update" },
      ipAddress: ip,
    });

    return apiSuccess(serializeToken(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    await ensurePuterTokenTable();
    const ip = getClientIp(request);
    const { id } = z.object({ id: z.string().cuid() }).parse(await parseJsonBody(request));

    await db.puterToken.delete({ where: { id } });
    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "puter_token",
      targetId: id,
      metadata: { action: "puter_token_delete" },
      ipAddress: ip,
    });

    return apiSuccess({ message: "AI token deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}

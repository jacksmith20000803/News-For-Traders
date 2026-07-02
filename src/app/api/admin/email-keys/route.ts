import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";

const SETTING_KEY = "email_verification_resend_keys";

type StoredEmailKey = {
  id: string;
  displayName: string;
  apiKey: string;
  fromEmail: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  try {
    await requireAdmin();
    const keys = await readEmailKeys();
    return apiSuccess({ keys: keys.map(maskEmailKey) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const displayName = readString(body.displayName);
    const apiKey = readString(body.apiKey);
    const fromEmail = readString(body.fromEmail);

    if (!displayName || !apiKey || !fromEmail) {
      return apiError("Display name, API key, and sender email are required.", 422);
    }

    const keys = await readEmailKeys();
    const now = new Date().toISOString();
    const next: StoredEmailKey = {
      id: randomUUID(),
      displayName,
      apiKey,
      fromEmail,
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    await writeEmailKeys([next, ...keys]);

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "email_key",
      targetId: next.id,
      metadata: { action: "email_key_create", displayName },
      ipAddress: getClientIp(request),
    });

    return apiSuccess({ key: maskEmailKey(next) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const id = readString(body.id);
    if (!id) return apiError("Key id is required.", 422);

    const keys = await readEmailKeys();
    const index = keys.findIndex((key) => key.id === id);
    if (index === -1) return apiError("Email key not found.", 404);

    const current = keys[index];
    const updated: StoredEmailKey = {
      ...current,
      displayName: readString(body.displayName) || current.displayName,
      fromEmail: readString(body.fromEmail) || current.fromEmail,
      apiKey: readString(body.apiKey) || current.apiKey,
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
      updatedAt: new Date().toISOString(),
    };
    keys[index] = updated;
    await writeEmailKeys(keys);

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "email_key",
      targetId: id,
      metadata: { action: "email_key_update", displayName: updated.displayName },
      ipAddress: getClientIp(request),
    });

    return apiSuccess({ key: maskEmailKey(updated) });
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
    if (!ids.length) return apiError("Select at least one email key to remove.", 422);

    const keys = await readEmailKeys();
    const next = keys.filter((key) => !ids.includes(key.id));
    await writeEmailKeys(next);

    await logAuditEvent({
      adminId: admin.id,
      action: "SETTINGS_UPDATE",
      targetType: "email_key",
      metadata: { action: "email_key_delete", ids, count: keys.length - next.length },
      ipAddress: getClientIp(request),
    });

    return apiSuccess({ deleted: keys.length - next.length });
  } catch (error) {
    return handleApiError(error);
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readEmailKeys(): Promise<StoredEmailKey[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting?.value) return [];
  try {
    const parsed = JSON.parse(setting.value) as StoredEmailKey[];
    return Array.isArray(parsed) ? parsed.filter(isStoredEmailKey) : [];
  } catch {
    return [];
  }
}

async function writeEmailKeys(keys: StoredEmailKey[]) {
  await db.siteSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(keys) },
    update: { value: JSON.stringify(keys) },
  });
}

function maskEmailKey(key: StoredEmailKey) {
  return {
    ...key,
    apiKey: `${key.apiKey.slice(0, 8)}...${key.apiKey.slice(-4)}`,
  };
}

function isStoredEmailKey(value: unknown): value is StoredEmailKey {
  if (!value || typeof value !== "object") return false;
  const key = value as Partial<StoredEmailKey>;
  return Boolean(key.id && key.displayName && key.apiKey && key.fromEmail);
}

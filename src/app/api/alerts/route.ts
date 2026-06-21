import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { priceAlertSchema, alertRuleSchema } from "@/lib/validations/trader";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();
    const [priceAlerts, rules] = await Promise.all([
      db.priceAlert.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      db.alertRule.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return apiSuccess({ priceAlerts, rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const kind = (body as { kind?: string }).kind ?? "price";

    if (kind === "rule") {
      const data = alertRuleSchema.parse(body);
      const rule = await db.alertRule.create({ data: { ...data, userId: user.id } });
      return apiSuccess(rule, 201);
    }

    const data = priceAlertSchema.parse(body);
    const alert = await db.priceAlert.create({
      data: { ...data, userId: user.id },
    });
    return apiSuccess(alert, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const { id, kind, isActive } = z
      .object({
        id: z.string().cuid(),
        kind: z.enum(["price", "rule"]),
        isActive: z.boolean(),
      })
      .parse(body);

    if (kind === "rule") {
      await db.alertRule.updateMany({ where: { id, userId: user.id }, data: { isActive } });
    } else {
      await db.priceAlert.updateMany({ where: { id, userId: user.id }, data: { isActive } });
    }

    return apiSuccess({ message: "Updated" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const kind = searchParams.get("kind") ?? "price";
    if (!id) return handleApiError(new Error("id required"));

    if (kind === "rule") {
      await db.alertRule.deleteMany({ where: { id, userId: user.id } });
    } else {
      await db.priceAlert.deleteMany({ where: { id, userId: user.id } });
    }

    return apiSuccess({ message: "Deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}

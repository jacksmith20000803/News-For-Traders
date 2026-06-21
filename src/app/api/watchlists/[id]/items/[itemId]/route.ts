import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id, itemId } = await params;

    const watchlist = await db.watchlist.findFirst({ where: { id, userId: user.id } });
    if (!watchlist) return apiError("Watchlist not found", 404);

    await db.watchlistItem.deleteMany({ where: { id: itemId, watchlistId: id } });
    return apiSuccess({ message: "Item removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id, itemId } = await params;
    const body = await parseJsonBody(request);
    const { sortOrder } = z.object({ sortOrder: z.number().int().min(0) }).parse(body);

    const watchlist = await db.watchlist.findFirst({ where: { id, userId: user.id } });
    if (!watchlist) return apiError("Watchlist not found", 404);

    await db.watchlistItem.updateMany({
      where: { id: itemId, watchlistId: id },
      data: { sortOrder },
    });

    return apiSuccess({ message: "Updated" });
  } catch (error) {
    return handleApiError(error);
  }
}

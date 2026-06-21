import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { watchlistItemSchema, itemReorderSchema } from "@/lib/validations/trader";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const watchlist = await db.watchlist.findFirst({
      where: { id, userId: user.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        alerts: { where: { isActive: true } },
      },
    });

    if (!watchlist) return apiError("Watchlist not found", 404);
    return apiSuccess(watchlist);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id } = await params;
    const body = await parseJsonBody(request);

    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      category: z.enum(["STOCKS", "FOREX", "CRYPTO", "COMMODITIES", "INDICES"]).optional(),
    });
    const data = updateSchema.parse(body);

    const watchlist = await db.watchlist.updateMany({
      where: { id, userId: user.id },
      data,
    });
    if (watchlist.count === 0) return apiError("Watchlist not found", 404);
    return apiSuccess({ message: "Updated" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(_req);
    const user = await requireAuth();
    const { id } = await params;

    await db.watchlist.deleteMany({ where: { id, userId: user.id } });
    return apiSuccess({ message: "Deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id } = await params;
    const body = await parseJsonBody(request);

    const watchlist = await db.watchlist.findFirst({ where: { id, userId: user.id } });
    if (!watchlist) return apiError("Watchlist not found", 404);

    const reorderResult = itemReorderSchema.safeParse(body);
    if (reorderResult.success) {
      const { itemIds } = reorderResult.data;
      await db.$transaction(
        itemIds.map((itemId, index) =>
          db.watchlistItem.updateMany({
            where: { id: itemId, watchlistId: id },
            data: { sortOrder: index },
          })
        )
      );
      return apiSuccess({ message: "Items reordered" });
    }

    const itemData = watchlistItemSchema.parse(body);
    const count = await db.watchlistItem.count({ where: { watchlistId: id } });

    const item = await db.watchlistItem.create({
      data: {
        watchlistId: id,
        symbol: itemData.symbol,
        assetType: itemData.assetType,
        category: itemData.category,
        sortOrder: count,
      },
    });

    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

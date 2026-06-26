import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

const favoriteSchema = z.object({
  symbol: z.string().min(1).max(20),
  assetType: z.string().min(1).max(20),
  category: z.enum(["STOCKS", "FOREX", "CRYPTO", "COMMODITIES", "INDICES"]).default("STOCKS"),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const favorites = await db.favoriteAsset.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
    });
    return apiSuccess(favorites);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = favoriteSchema.parse(await parseJsonBody(request));
    const count = await db.favoriteAsset.count({ where: { userId: user.id } });

    const fav = await db.favoriteAsset.upsert({
      where: {
        userId_symbol_assetType: {
          userId: user.id,
          symbol: data.symbol,
          assetType: data.assetType,
        },
      },
      update: {},
      create: { userId: user.id, ...data, sortOrder: count },
    });
    return apiSuccess(fav, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const assetType = searchParams.get("assetType");
    if (!symbol || !assetType) return apiSuccess({ message: "Missing params" }, 422);

    await db.favoriteAsset.deleteMany({
      where: { userId: user.id, symbol, assetType },
    });
    return apiSuccess({ message: "Removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

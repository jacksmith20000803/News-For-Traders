import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  watchlistCreateSchema,
  watchlistReorderSchema,
} from "@/lib/validations/trader";

export async function GET() {
  try {
    const user = await requireAuth();
    const watchlists = await db.watchlist.findMany({
      where: { userId: user.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        alerts: { where: { isActive: true }, take: 5 },
        _count: { select: { items: true, alerts: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    const quotes = await db.marketQuote.findMany();
    const quoteMap = new Map(quotes.map((q) => [`${q.symbol}:${q.assetType}`, q]));

    const enriched = watchlists.map((wl) => ({
      ...wl,
      items: wl.items.map((item) => ({
        ...item,
        quote: quoteMap.get(`${item.symbol}:${item.assetType}`) ?? null,
      })),
    }));

    return apiSuccess(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = watchlistCreateSchema.parse(body);

    const count = await db.watchlist.count({ where: { userId: user.id } });
    const watchlist = await db.watchlist.create({
      data: {
        userId: user.id,
        name: data.name,
        category: data.category,
        sortOrder: count,
      },
      include: { items: true },
    });

    return apiSuccess(watchlist, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const { watchlistIds } = watchlistReorderSchema.parse(body);

    await db.$transaction(
      watchlistIds.map((id, index) =>
        db.watchlist.updateMany({
          where: { id, userId: user.id },
          data: { sortOrder: index },
        })
      )
    );

    return apiSuccess({ message: "Watchlists reordered" });
  } catch (error) {
    return handleApiError(error);
  }
}

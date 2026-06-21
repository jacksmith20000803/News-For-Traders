import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getPortfolioSummary } from "@/lib/trader/queries";
import { portfolioPositionSchema } from "@/lib/validations/trader";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();
    const summary = await getPortfolioSummary(user.id);

    if (!summary) {
      const portfolio = await db.portfolio.create({
        data: { userId: user.id, name: "Main Portfolio" },
        include: { positions: true },
      });
      return apiSuccess({
        portfolio,
        positions: [],
        totalValue: 0,
        totalCost: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        allocation: [],
      });
    }

    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);

    const positionResult = portfolioPositionSchema.safeParse(body);
    if (positionResult.success) {
      const data = positionResult.data;
      let portfolioId = data.portfolioId;

      if (!portfolioId) {
        const existing = await db.portfolio.findFirst({ where: { userId: user.id } });
        if (existing) {
          portfolioId = existing.id;
        } else {
          const created = await db.portfolio.create({
            data: { userId: user.id, name: "Main Portfolio" },
          });
          portfolioId = created.id;
        }
      }

      const position = await db.portfolioPosition.create({
        data: {
          portfolioId: portfolioId!,
          symbol: data.symbol,
          assetType: data.assetType,
          category: data.category,
          quantity: data.quantity,
          entryPrice: data.entryPrice,
          notes: data.notes,
        },
      });
      return apiSuccess(position, 201);
    }

    // Create portfolio
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(body);
    const portfolio = await db.portfolio.create({
      data: { userId: user.id, name },
    });
    return apiSuccess(portfolio, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");
    if (!positionId) return apiError("positionId required", 422);

    const position = await db.portfolioPosition.findFirst({
      where: { id: positionId },
      include: { portfolio: { select: { userId: true } } },
    });
    if (!position || position.portfolio.userId !== user.id) {
      return apiError("Position not found", 404);
    }

    await db.portfolioPosition.delete({ where: { id: positionId } });
    return apiSuccess({ message: "Position removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const accounts = await db.oAuthAccount.findMany({
      where: { userId: user.id },
      select: { provider: true },
      orderBy: { provider: "asc" },
    });

    return apiSuccess({
      providers: Array.from(new Set(accounts.map((account) => account.provider))),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

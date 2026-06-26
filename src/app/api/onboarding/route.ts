import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

const onboardingSchema = z.object({
  preferredMarket: z.enum(["CRYPTO", "FOREX", "STOCKS", "COMMODITIES"]),
  categories: z.array(z.enum(["FOREX", "STOCKS", "CRYPTO", "COMMODITIES", "FUTURES", "MACROECONOMICS"])).min(1),
  defaultSymbol: z.string().optional(),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  priceAlerts: z.boolean().default(true),
  newsAlerts: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const data = onboardingSchema.parse(await parseJsonBody(request));

    await db.$transaction([
      db.userPreferences.upsert({
        where: { userId: user.id },
        create: { userId: user.id, preferredMarket: data.preferredMarket, defaultSymbol: data.defaultSymbol ?? "BTC/USD" },
        update: { preferredMarket: data.preferredMarket, defaultSymbol: data.defaultSymbol },
      }),
      db.notificationSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          emailEnabled: data.emailEnabled,
          pushEnabled: data.pushEnabled,
          priceAlerts: data.priceAlerts,
          newsAlerts: data.newsAlerts,
        },
        update: {
          emailEnabled: data.emailEnabled,
          pushEnabled: data.pushEnabled,
          priceAlerts: data.priceAlerts,
          newsAlerts: data.newsAlerts,
        },
      }),
      db.userInterest.deleteMany({ where: { userId: user.id } }),
      db.userInterest.createMany({
        data: data.categories.map((category) => ({ userId: user.id, category })),
      }),
      db.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } }),
    ]);

    return apiSuccess({ message: "Onboarding complete" });
  } catch (error) {
    return handleApiError(error);
  }
}

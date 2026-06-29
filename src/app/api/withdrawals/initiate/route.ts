import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { validateCsrf } from "@/lib/auth/guards";
import { requireFreshMfa } from "@/lib/auth/step-up";

const withdrawalSchema = z.object({
  amount: z.number().positive(),
  address: z.string().trim().min(8),
});

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireFreshMfa();
    const data = withdrawalSchema.parse(await parseJsonBody(request));

    return apiSuccess({
      message: "Withdrawal initiated",
      amount: data.amount,
      address: data.address,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

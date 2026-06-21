import { apiSuccess } from "@/lib/api/response";
import { isAIConfigured } from "@/lib/providers/ai/openai";

export async function GET() {
  return apiSuccess({ configured: isAIConfigured() });
}

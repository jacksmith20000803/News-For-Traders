import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return apiSuccess({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    return apiSuccess({ status: "degraded", database: "unreachable" }, 503);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { getCurrentSessionId } from "@/lib/auth/session";
import { db } from "@/lib/db";

const revokeDeviceSchema = z.object({
  type: z.enum(["session", "trustedDevice"]),
  id: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const currentSessionId = await getCurrentSessionId();

    const [sessions, trustedDevices] = await Promise.all([
      db.session.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      db.trustedDevice.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          deviceName: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

    return apiSuccess({
      sessions: sessions.map((session) => ({
        ...session,
        current: session.id === currentSessionId,
      })),
      trustedDevices,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = revokeDeviceSchema.parse(body);
    const currentSessionId = await getCurrentSessionId();

    if (data.type === "session") {
      if (data.id === currentSessionId) {
        return apiError("Use Log Out to end the current session.", 400, "CURRENT_SESSION");
      }

      await db.session.deleteMany({
        where: { id: data.id, userId: user.id },
      });
      return apiSuccess({ message: "Session revoked" });
    }

    await db.trustedDevice.deleteMany({
      where: { id: data.id, userId: user.id },
    });
    return apiSuccess({ message: "Trusted device removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

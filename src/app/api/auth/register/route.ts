import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/security/password";
import { db } from "@/lib/db";
import { createUserSession, setCsrfCookie, toSafeUser } from "@/lib/auth/session";
import { createSignedCsrfToken, generateToken } from "@/lib/security/csrf";
import { hashToken } from "@/lib/security/tokens";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { logUserActivity } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `register:${ip}`,
      config.rateLimit.authMaxRequests,
      config.rateLimit.windowMs
    );

    if (!rateLimit.success) {
      return apiError("Too many registration attempts. Please try again later.", 429);
    }

    const body = await parseJsonBody(request);
    const data = registerSchema.parse(body);
    const email = data.email.toLowerCase();

    const passwordHash = await hashPassword(data.password);

    let user;
    try {
      user = await db.user.create({
        data: { name: data.name, email, passwordHash },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return apiError("An account with this email already exists", 409);
      }
      throw error;
    }

    const verificationToken = generateToken();
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: hashToken(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await createUserSession(
      user.id,
      ip,
      request.headers.get("user-agent") ?? undefined
    );

    const csrfToken = createSignedCsrfToken();
    await setCsrfCookie(csrfToken);
    await logUserActivity(user.id, "REGISTER");

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        bio: true,
        reputation: true,
        contributionCount: true,
        emailVerified: true,
        twoFactorEnabled: true,
        isSuspended: true,
        isBanned: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    return apiSuccess(
      {
        user: fullUser ? toSafeUser(fullUser) : null,
        csrfToken,
        message: "Account created successfully. Please verify your email.",
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

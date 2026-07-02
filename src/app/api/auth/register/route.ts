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
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { logUserActivity } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { parseUserAgent, parseGeoFromHeaders } from "@/lib/security/user-agent";
import { isDatabaseConnectivityError } from "@/lib/db-errors";
import { createAndSendVerificationCode } from "@/lib/verification/email-verification";
import { checkVpnStatus, toIpRiskDbFields } from "@/lib/security/ip-intelligence";

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
        data: {
          name: data.name,
          email,
          passwordHash,
          onboardingCompleted: true,
        },
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

    await createUserSession(
      user.id,
      ip,
      request.headers.get("user-agent") ?? undefined,
      { mfaVerified: false, authTime: Math.floor(Date.now() / 1000), emailVerified: false }
    );

    const csrfToken = createSignedCsrfToken();
    await setCsrfCookie(csrfToken);

    const ua = parseUserAgent(request.headers.get("user-agent"));
    const geo = parseGeoFromHeaders(request.headers);

    schedulePostRegistrationTasks({
      userId: user.id,
      name: data.name,
      email,
      ip,
      country: geo.country ?? undefined,
      city: geo.city ?? undefined,
      browser: ua.browser,
      deviceType: ua.deviceType,
      os: ua.os,
      userAgent: ua.userAgent,
    });

    return apiSuccess(
      {
        user: toSafeUser(user),
        csrfToken,
        message: "Account created successfully. You can start using tradx now; verify your email from your profile when ready.",
        redirectTo: "/dashboard",
      },
      201
    );
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return apiError(
        "Registration is temporarily unavailable because the database connection is offline. Please check the DATABASE_URL or database service status.",
        503,
        "DATABASE_UNAVAILABLE"
      );
    }

    return handleApiError(error);
  }
}

function schedulePostRegistrationTasks(params: {
  userId: string;
  name: string;
  email: string;
  ip: string;
  country?: string;
  city?: string;
  browser: string;
  deviceType: string;
  os: string;
  userAgent: string;
}) {
  setTimeout(() => {
    void runPostRegistrationTasks(params);
  }, 0);
}

async function runPostRegistrationTasks(params: {
  userId: string;
  name: string;
  email: string;
  ip: string;
  country?: string;
  city?: string;
  browser: string;
  deviceType: string;
  os: string;
  userAgent: string;
}) {
  const ipRisk = await checkVpnStatus(params.ip);
  const ipRiskFields = toIpRiskDbFields(ipRisk);

  await Promise.allSettled([
    createAndSendVerificationCode(params.userId, params.email),
    logUserActivity(params.userId, "REGISTER", {
      vpnDetected: ipRisk.isVpn,
      vpnProvider: ipRisk.provider,
      ipAsn: ipRisk.asn,
      ipCompany: ipRisk.organization,
      ipRiskSource: ipRisk.source,
    }),
    db.registrationAudit.create({
      data: {
        userId: params.userId,
        ipAddress: params.ip,
        country: params.country,
        city: params.city,
        browser: params.browser,
        deviceType: params.deviceType,
        os: params.os,
        userAgent: params.userAgent,
        ...ipRiskFields,
      },
    }),
    db.userPreferences.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId },
      update: {},
    }),
    db.notificationSettings.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId },
      update: {},
    }),
    notifyAdminsOfRegistration(params.userId, params.name, params.email, params.country),
  ]);
}

async function notifyAdminsOfRegistration(
  userId: string,
  name: string,
  email: string,
  country?: string
) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "NEW_REGISTRATION",
        title: "New user registered",
        message: `${name} (${email}) joined TRADX`,
        metadata: { userId, country },
      })
    )
  );
}

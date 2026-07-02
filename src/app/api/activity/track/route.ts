import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { checkVpnStatus, toIpRiskDbFields } from "@/lib/security/ip-intelligence";

const VISITOR_COOKIE = "tradx_visitor_id";

const activitySchema = z.object({
  visitorId: z.string().min(8).max(80),
  action: z.string().min(2).max(80),
  path: z.string().max(500).optional(),
  target: z.string().max(240).optional(),
  metadata: z.record(z.unknown()).optional(),
  client: z
    .object({
      timezone: z.string().max(80).optional(),
      language: z.string().max(32).optional(),
      screen: z.string().max(80).optional(),
      browser: z.string().max(80).optional(),
      os: z.string().max(80).optional(),
      deviceType: z.string().max(40).optional(),
    })
    .optional(),
});

function pickHeader(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

function parseUserAgent(userAgent: string) {
  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : /OPR\//.test(userAgent)
              ? "Opera"
              : "Unknown browser";

  const os =
    /Windows NT/i.test(userAgent)
      ? "Windows"
      : /Mac OS X/i.test(userAgent)
        ? "macOS"
        : /Android/i.test(userAgent)
          ? "Android"
          : /iPhone|iPad|iPod/i.test(userAgent)
            ? "iOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Unknown OS";

  const deviceType =
    /iPad|Tablet/i.test(userAgent)
      ? "Tablet"
      : /Mobile|Android|iPhone|iPod/i.test(userAgent)
        ? "Mobile"
        : "Desktop";

  return { browser, os, deviceType };
}

function compactMetadata(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  const metadata: Record<string, Prisma.InputJsonValue> = {};
  if (!value) return metadata;

  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (typeof item === "string") metadata[key] = item.slice(0, 500);
    else if (typeof item === "number" || typeof item === "boolean") metadata[key] = item;
  }

  return metadata;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`activity:${ip}`, 180, 60_000);
    if (!rateLimit.success) {
      return apiSuccess({ recorded: false });
    }

    const user = await getCurrentUser().catch(() => null);
    const body = activitySchema.parse(await parseJsonBody(request));
    const userAgent = request.headers.get("user-agent") ?? "";
    const parsedAgent = parseUserAgent(userAgent);
    const visitorId = body.visitorId || request.cookies.get(VISITOR_COOKIE)?.value || crypto.randomUUID();
    const country =
      pickHeader(request, ["x-vercel-ip-country", "cf-ipcountry", "x-country"]) ??
      null;
    const region = pickHeader(request, ["x-vercel-ip-country-region", "x-region"]);
    const city = pickHeader(request, ["x-vercel-ip-city", "x-city"]);
    const ipRisk = await checkVpnStatus(ip);
    const ipRiskFields = toIpRiskDbFields(ipRisk);

    const clientMetadata = compactMetadata({
      ...body.metadata,
      language: body.client?.language,
      screen: body.client?.screen,
      vpnDetected: ipRisk.isVpn,
      vpnProvider: ipRisk.provider ?? undefined,
      ipAsn: ipRisk.asn ?? undefined,
      ipCompany: ipRisk.organization ?? undefined,
    });

    await db.$transaction([
      db.visitorActivity.create({
        data: {
          visitorId,
          userId: user?.id ?? null,
          action: body.action,
          path: body.path,
          target: body.target,
          ipAddress: ip,
          country,
          region,
          city,
          timezone: body.client?.timezone,
          browser: body.client?.browser ?? parsedAgent.browser,
          os: body.client?.os ?? parsedAgent.os,
          deviceType: body.client?.deviceType ?? parsedAgent.deviceType,
          userAgent: userAgent.slice(0, 1000),
          ...ipRiskFields,
          metadata: clientMetadata,
        },
      }),
      ...(user
        ? [
            db.userActivity.create({
              data: {
                userId: user.id,
                action: body.action,
                metadata: {
                  path: body.path,
                  target: body.target,
                  visitorId,
                  ...clientMetadata,
                },
              },
            }),
          ]
        : []),
    ]);

    const response = apiSuccess({ recorded: true, visitorId });
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

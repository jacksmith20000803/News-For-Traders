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
  visitorId: z.string().min(8).max(80).optional(),
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
      webrtcIps: z.array(z.string().max(80)).max(8).optional(),
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
    const serverIp = getClientIp(request);
    const rateLimit = checkRateLimit(`activity:${serverIp}`, 180, 60_000);
    if (!rateLimit.success) {
      return apiSuccess({ recorded: false });
    }

    const user = await getCurrentUser().catch(() => null);
    const body = activitySchema.parse(await parseJsonBody(request));
    const userAgent = request.headers.get("user-agent") ?? "";
    const parsedAgent = parseUserAgent(userAgent);
    const webrtcIps = sanitizePublicIps(body.client?.webrtcIps ?? []);
    const ip = selectBestIp(serverIp, webrtcIps);
    const visitorId =
      body.visitorId ||
      request.cookies.get(VISITOR_COOKIE)?.value ||
      deterministicVisitorId(ip, userAgent);
    const headerCountry =
      pickHeader(request, ["x-vercel-ip-country", "cf-ipcountry", "x-country"]) ??
      null;
    const headerRegion = pickHeader(request, ["x-vercel-ip-country-region", "x-region"]);
    const headerCity = pickHeader(request, ["x-vercel-ip-city", "x-city"]);
    const headerTimezone = body.client?.timezone ?? pickHeader(request, ["x-vercel-ip-timezone", "x-timezone"]) ?? undefined;
    const ipRisk = await checkVpnStatus(ip);
    const ipRiskFields = toIpRiskDbFields(ipRisk);
    const country = headerCountry ?? ipRisk.countryName ?? ipRisk.countryCode ?? null;
    const region = headerRegion ?? ipRisk.regionName ?? null;
    const city = headerCity ?? ipRisk.city ?? null;
    const timezone = headerTimezone ?? ipRisk.timezone ?? undefined;

    const clientMetadata = compactMetadata({
      ...body.metadata,
      language: body.client?.language,
      screen: body.client?.screen,
      vpnDetected: ipRisk.isVpn,
      vpnProvider: ipRisk.provider ?? undefined,
      ipAsn: ipRisk.asn ?? undefined,
      ipCompany: ipRisk.organization ?? undefined,
      serverIp,
      actualIp: ip,
      ipSource: ip === serverIp ? "request" : "webrtc",
      webrtcIps: webrtcIps.join(", "),
    });

    const visitorData = {
      visitorId,
      userId: user?.id ?? null,
      action: body.action,
      path: body.path,
      target: body.target,
      ipAddress: ip,
      country,
      region,
      city,
      timezone,
      browser: body.client?.browser ?? parsedAgent.browser,
      os: body.client?.os ?? parsedAgent.os,
      deviceType: body.client?.deviceType ?? parsedAgent.deviceType,
      userAgent: userAgent.slice(0, 1000),
      ...ipRiskFields,
      metadata: clientMetadata,
    };

    const existingAnonymousVisitor =
      user || !ip
        ? null
        : await db.visitorActivity.findFirst({
            where: { ipAddress: ip, userId: null },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });

    await db.$transaction([
      existingAnonymousVisitor
        ? db.visitorActivity.update({
            where: { id: existingAnonymousVisitor.id },
            data: { ...visitorData, createdAt: new Date() },
          })
        : db.visitorActivity.create({ data: visitorData }),
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

function deterministicVisitorId(ip: string, userAgent: string) {
  const source = `${ip}|${userAgent || "unknown"}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `server-${hash.toString(36).padStart(8, "0")}`;
}

function sanitizePublicIps(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeIp(value)).filter((value): value is string => !!value && !isNonPublicIp(value)))).slice(0, 8);
}

function selectBestIp(serverIp: string, webrtcIps: string[]) {
  const normalizedServerIp = normalizeIp(serverIp) ?? serverIp;
  if (!isNonPublicIp(normalizedServerIp)) return normalizedServerIp;
  return webrtcIps[0] ?? normalizedServerIp;
}

function normalizeIp(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") && trimmed.includes("]")) return trimmed.slice(1, trimmed.indexOf("]"));
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) return trimmed.replace(/:\d+$/, "");
  return trimmed;
}

function isNonPublicIp(ipAddress: string) {
  const lower = ipAddress.toLowerCase();
  if (lower === "localhost" || lower === "::1" || lower === "127.0.0.1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  const parts = lower.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

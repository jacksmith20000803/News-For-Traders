import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { getClientIp } from "@/lib/security/rate-limit";

const VISITOR_COOKIE = "tradx_visitor_id";

type BotEventKind = "downloaded" | "installed";

type DeviceInfo = {
  browser: string;
  os: string;
  deviceType: string;
  userAgent: string;
  platform: string;
};

export async function recordTradingBotEvent(request: NextRequest, kind: BotEventKind) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const device = parseUserAgent(userAgent);
  const geo = readGeo(request);
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? request.nextUrl.searchParams.get("visitorId");
  const user = await resolveEventUser(visitorId, ip, userAgent);
  const action = kind === "downloaded" ? "trading_bot_app_downloaded" : "trading_bot_app_installed";

  const metadata: Prisma.InputJsonObject = {
    source: "trading_bot_app",
    event: kind,
    path: request.nextUrl.pathname,
    href: request.nextUrl.toString().slice(0, 500),
    ip,
    country: geo.country ?? "",
    region: geo.region ?? "",
    city: geo.city ?? "",
    timezone: geo.timezone ?? "",
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    platform: device.platform,
    userAgent: device.userAgent.slice(0, 500),
  };

  await db.$transaction([
    db.visitorActivity.create({
      data: {
        visitorId: visitorId || `server-${crypto.randomUUID()}`,
        userId: user?.id ?? null,
        action,
        path: request.nextUrl.pathname,
        target: "trading-bot-app",
        ipAddress: ip,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone,
        browser: device.browser,
        os: device.os,
        deviceType: device.deviceType,
        userAgent: userAgent.slice(0, 1000),
        metadata,
      },
    }),
    ...(user
      ? [
          db.userActivity.create({
            data: {
              userId: user.id,
              action,
              metadata,
            },
          }),
        ]
      : []),
  ]);

  await notifyAdminsAboutBotEvent({
    kind,
    actor: user
      ? {
          id: user.id,
          name: user.username || user.name,
          avatar: user.avatar,
          country: geo.country,
        }
      : {
          id: null,
          name: "Visitor",
          avatar: null,
          country: geo.country,
        },
    location: formatLocation(geo),
    time: new Date(),
    device,
    ip,
  });
}

async function resolveEventUser(visitorId: string | null, ip: string, userAgent: string) {
  const current = await getCurrentUser().catch(() => null);
  if (current) return current;

  const linkedVisitorActivity = visitorId
    ? await db.visitorActivity.findFirst({
        where: { visitorId, userId: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { user: true },
      })
    : null;
  if (linkedVisitorActivity?.user) return linkedVisitorActivity.user;

  const linkedByNetwork = await db.visitorActivity.findFirst({
    where: {
      ipAddress: ip,
      userAgent: userAgent ? { equals: userAgent.slice(0, 1000) } : undefined,
      userId: { not: null },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  return linkedByNetwork?.user ?? null;
}

async function notifyAdminsAboutBotEvent({
  kind,
  actor,
  location,
  time,
  device,
  ip,
}: {
  kind: BotEventKind;
  actor: { id: string | null; name: string; avatar: string | null; country: string | null };
  location: string;
  time: Date;
  device: DeviceInfo;
  ip: string;
}) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", deletedAt: null, isBanned: false, isSuspended: false },
    select: { id: true },
  });
  if (!admins.length) return;

  const timeText = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
  const verb = kind === "downloaded" ? "downloaded the file" : "installed the file";
  const message = `${actor.name} (${location || "location unknown"}) ${verb} at ${timeText}`;

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "SYSTEM",
        title: kind === "downloaded" ? "Trading bot downloaded" : "Trading bot installed",
        message,
        metadata: {
          actorUserId: actor.id,
          actorName: actor.name,
          actorAvatar: actor.avatar,
          actorCountry: actor.country,
          location,
          ipAddress: ip,
          browser: device.browser,
          os: device.os,
          deviceType: device.deviceType,
          platform: device.platform,
          eventType: `trading_bot_${kind}`,
        },
      })
    )
  );
}

function readGeo(request: NextRequest) {
  return {
    country: pickHeader(request, ["x-vercel-ip-country", "cf-ipcountry", "x-country"]),
    region: pickHeader(request, ["x-vercel-ip-country-region", "x-region"]),
    city: pickHeader(request, ["x-vercel-ip-city", "x-city"]),
    timezone: pickHeader(request, ["x-vercel-ip-timezone", "x-timezone"]),
  };
}

function pickHeader(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

function formatLocation(geo: ReturnType<typeof readGeo>) {
  return [geo.city, geo.region, countryDisplayName(geo.country)].filter(Boolean).join(", ");
}

function countryDisplayName(countryCode: string | null | undefined) {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return countryCode?.trim() || "";

  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

function parseUserAgent(userAgent: string): DeviceInfo {
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

  return { browser, os, deviceType, userAgent, platform: os };
}

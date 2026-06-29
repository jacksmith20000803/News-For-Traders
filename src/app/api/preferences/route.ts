import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { PreferredMarket } from "@prisma/client";
import { z } from "zod";

const profileSchema = z.object({
  section: z.literal("profile").optional(),
  name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  preferredLanguage: z.string().max(10).optional(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
});

const notifSettingsSchema = z.object({
  section: z.literal("notifications").optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  newsAlerts: z.boolean().optional(),
  adminMessages: z.boolean().optional(),
  profileChanges: z.boolean().optional(),
  systemAnnounce: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

const connectionSettingsSchema = z.object({
  section: z.literal("connection"),
  preferredMarket: z.nativeEnum(PreferredMarket).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  chartInterval: z.enum(["100ms", "1M", "5M", "15M", "1H", "4H", "1D", "1W"]).optional(),
  defaultSymbol: z.string().trim().min(1).max(20).optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const [profile, preferences, notificationSettings, favorites] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, name: true, username: true, email: true, bio: true, avatar: true,
          country: true, timezone: true, preferredLanguage: true, dateOfBirth: true,
          onboardingCompleted: true,
        },
      }),
      db.userPreferences.findUnique({ where: { userId: user.id } }),
      db.notificationSettings.findUnique({ where: { userId: user.id } }),
      db.favoriteAsset.findMany({ where: { userId: user.id }, orderBy: { sortOrder: "asc" } }),
    ]);
    return apiSuccess({ profile, preferences, notificationSettings, favorites });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const rawBody = await parseJsonBody(request);
    const body = isRecord(rawBody) ? rawBody : {};

    if (body.section === "connection") {
      const data = connectionSettingsSchema.parse(body);
      const settingsData = {
        preferredMarket: data.preferredMarket,
        theme: data.theme,
        chartInterval: data.chartInterval,
        defaultSymbol: data.defaultSymbol,
      };
      const settings = await db.userPreferences.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...settingsData },
        update: settingsData,
      });
      return apiSuccess(settings);
    }

    const notificationKeys = [
      "emailEnabled",
      "pushEnabled",
      "inAppEnabled",
      "priceAlerts",
      "newsAlerts",
      "adminMessages",
      "profileChanges",
      "systemAnnounce",
      "marketingEmails",
    ];

    if (body.section === "notifications" || notificationKeys.some((key) => key in body)) {
      const data = notifSettingsSchema.parse(body);
      const settingsData = {
        emailEnabled: data.emailEnabled,
        pushEnabled: data.pushEnabled,
        inAppEnabled: data.inAppEnabled,
        priceAlerts: data.priceAlerts,
        newsAlerts: data.newsAlerts,
        adminMessages: data.adminMessages,
        profileChanges: data.profileChanges,
        systemAnnounce: data.systemAnnounce,
        marketingEmails: data.marketingEmails,
      };
      const settings = await db.notificationSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...settingsData },
        update: settingsData,
      });
      return apiSuccess(settings);
    }

    const data = profileSchema.parse(body);
    const profileData = {
      name: data.name,
      username: data.username,
      bio: data.bio,
      country: data.country,
      timezone: data.timezone,
      preferredLanguage: data.preferredLanguage,
      dateOfBirth: data.dateOfBirth,
      avatar: data.avatar,
    };
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name: profileData.name,
        username: profileData.username,
        bio: profileData.bio,
        country: profileData.country,
        timezone: profileData.timezone,
        preferredLanguage: profileData.preferredLanguage,
        avatar: profileData.avatar,
        dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : profileData.dateOfBirth === null ? null : undefined,
      },
    });

    const admins = await db.user.findMany({ where: { role: "ADMIN", deletedAt: null }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "PROFILE_CHANGE",
          title: "Profile updated",
          message: `${updated.name} updated their profile`,
          metadata: { userId: user.id },
        })
      )
    );

    await db.auditLog.create({
      data: {
        adminId: user.id,
        action: "USER_PROFILE_UPDATE",
        targetType: "User",
        targetId: user.id,
        metadata: { fields: Object.keys(profileData) },
      },
    });

    return apiSuccess({ id: updated.id, name: updated.name, username: updated.username });
  } catch (error) {
    return handleApiError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

const profileSchema = z.object({
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
    const body = await parseJsonBody(request);

    if (notifSettingsSchema.safeParse(body).success) {
      const data = notifSettingsSchema.parse(body);
      const settings = await db.notificationSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data },
        update: data,
      });
      return apiSuccess(settings);
    }

    const data = profileSchema.parse(body);
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        username: data.username,
        bio: data.bio,
        country: data.country,
        timezone: data.timezone,
        preferredLanguage: data.preferredLanguage,
        avatar: data.avatar,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : data.dateOfBirth === null ? null : undefined,
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
        metadata: { fields: Object.keys(data) },
      },
    });

    return apiSuccess({ id: updated.id, name: updated.name, username: updated.username });
  } catch (error) {
    return handleApiError(error);
  }
}

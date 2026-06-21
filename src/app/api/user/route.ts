import { NextRequest } from "next/server";
import {
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAuth, validateCsrf } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { interestsSchema } from "@/lib/validations/content";

export async function GET() {
  try {
    const user = await requireAuth();

    const [profile, interests, bookmarks, watchlists, notifications, activities] =
      await Promise.all([
        db.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            avatar: true,
            reputation: true,
            contributionCount: true,
            emailVerified: true,
            twoFactorEnabled: true,
            createdAt: true,
            badges: { include: { badge: true } },
          },
        }),
        db.userInterest.findMany({ where: { userId: user.id } }),
        db.bookmark.findMany({
          where: { userId: user.id },
          include: {
            news: { include: { source: true } },
            article: { select: { id: true, title: true, slug: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        db.watchlist.findMany({ where: { userId: user.id } }),
        db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        db.userActivity.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      ]);

    return apiSuccess({
      profile,
      interests,
      bookmarks,
      watchlists,
      notifications,
      activities,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const { updateProfileSchema } = await import("@/lib/validations/auth");
    const data = updateProfileSchema.parse(body);

    const updated = await db.user.update({
      where: { id: user.id },
      data,
    });

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      bio: updated.bio,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await parseJsonBody(request);
    const data = interestsSchema.parse(body);

    await db.$transaction([
      db.userInterest.deleteMany({ where: { userId: user.id } }),
      db.userInterest.createMany({
        data: data.categories.map((category) => ({
          userId: user.id,
          category,
        })),
      }),
    ]);

    return apiSuccess({ message: "Interests updated" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date(), email: `deleted_${user.id}@deleted.local` },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);

    const { destroySession } = await import("@/lib/auth/session");
    await destroySession();

    return apiSuccess({ message: "Account deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}

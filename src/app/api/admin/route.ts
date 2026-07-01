import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from "@/lib/api/response";
import { requireAdmin, validateCsrf } from "@/lib/auth/guards";
import { safeUserSelect } from "@/lib/auth/user-select";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { invalidateSettingsCache } from "@/lib/settings";
import {
  adminUserUpdateSchema,
  adminActionSchema,
  newsCreateSchema,
  newsUpdateSchema,
  articleAdminSchema,
  discussionAdminSchema,
  commentAdminSchema,
  resolveReportSchema,
} from "@/lib/validations/content";
import { generateToken } from "@/lib/security/csrf";
import { hashToken } from "@/lib/security/tokens";
import { notifyModerationAction } from "@/lib/notifications";

export async function GET() {
  try {
    await requireAdmin();

    const [
      userCount,
      articleCount,
      newsCount,
      discussionCount,
      reportCount,
      recentUsers,
      recentAuditLogs,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.article.count(),
      db.news.count(),
      db.discussion.count(),
      db.report.count({ where: { status: "PENDING" } }),
      db.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: safeUserSelect,
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { admin: { select: { name: true } } },
      }),
    ]);

    const usersByRole = await db.user.groupBy({
      by: ["role"],
      _count: true,
      where: { deletedAt: null },
    });

    return apiSuccess({
      stats: {
        users: userCount,
        articles: articleCount,
        news: newsCount,
        discussions: discussionCount,
        pendingReports: reportCount,
      },
      usersByRole,
      recentUsers,
      recentAuditLogs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(
      `admin:${ip}`,
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );
    if (!rateLimit.success) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    await validateCsrf(request);
    const admin = await requireAdmin();
    const body = await parseJsonBody(request);
    const { action } = adminActionSchema.parse(body);
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    switch (action) {
      case "create_news": {
        const newsData = newsCreateSchema.parse(data);
        const news = await db.news.create({
          data: {
            headline: newsData.headline,
            summary: newsData.summary,
            content: newsData.content,
            sourceId: newsData.sourceId,
            categoryId: newsData.categoryId,
            importance: newsData.importance,
            reliabilityStatus: newsData.reliabilityStatus,
            createdById: admin.id,
            assets: newsData.assets ? { create: newsData.assets } : undefined,
          },
        });
        await logAuditEvent({
          adminId: admin.id,
          action: "NEWS_CREATE",
          targetType: "news",
          targetId: news.id,
          ipAddress: ip,
        });
        return apiSuccess(news, 201);
      }

      case "update_user": {
        const { userId, ...updates } = data as { userId: string };
        if (!userId || typeof userId !== "string") {
          return apiError("userId is required", 422);
        }

        const parsed = adminUserUpdateSchema.parse(updates);

        if (userId === admin.id && parsed.role && parsed.role !== "ADMIN") {
          return apiError("Cannot demote your own admin account", 403);
        }

        if (parsed.role && parsed.role !== "ADMIN") {
          const adminCount = await db.user.count({
            where: { role: "ADMIN", deletedAt: null, id: { not: userId } },
          });
          const target = await db.user.findUnique({ where: { id: userId } });
          if (target?.role === "ADMIN" && adminCount === 0) {
            return apiError("Cannot remove the last administrator", 403);
          }
        }

        const updated = await db.user.update({
          where: { id: userId },
          data: parsed,
          select: safeUserSelect,
        });

        if (parsed.role || parsed.isBanned) {
          await db.session.deleteMany({ where: { userId } });
        }

        if (parsed.role) {
          await logAuditEvent({
            adminId: admin.id,
            action: "USER_ROLE_CHANGE",
            targetType: "user",
            targetId: userId,
            metadata: { role: parsed.role },
            ipAddress: ip,
          });
        }
        if (parsed.isBanned) {
          await logAuditEvent({
            adminId: admin.id,
            action: "USER_BAN",
            targetType: "user",
            targetId: userId,
            ipAddress: ip,
          });
        }
        return apiSuccess(updated);
      }

      case "resolve_report": {
        const reportData = resolveReportSchema.parse(data);
        const report = await db.report.update({
          where: { id: reportData.reportId },
          data: {
            status: reportData.status,
            reviewedById: admin.id,
            reviewedAt: new Date(),
          },
        });
        await logAuditEvent({
          adminId: admin.id,
          action: "REPORT_RESOLVE",
          targetType: "report",
          targetId: reportData.reportId,
          ipAddress: ip,
        });
        return apiSuccess(report);
      }

      case "update_news": {
        const newsData = newsUpdateSchema.parse(data);
        const { newsId, ...updates } = newsData;
        const news = await db.news.update({ where: { id: newsId }, data: updates });
        await logAuditEvent({
          adminId: admin.id,
          action: "NEWS_UPDATE",
          targetType: "news",
          targetId: newsId,
          ipAddress: ip,
        });
        return apiSuccess(news);
      }

      case "delete_news": {
        const { newsId } = data as { newsId: string };
        if (!newsId) return apiError("newsId is required", 422);
        await db.news.delete({ where: { id: newsId } });
        await logAuditEvent({
          adminId: admin.id,
          action: "NEWS_DELETE",
          targetType: "news",
          targetId: newsId,
          ipAddress: ip,
        });
        return apiSuccess({ message: "News deleted" });
      }

      case "pin_news": {
        const { newsId, isPinned } = data as { newsId: string; isPinned: boolean };
        if (!newsId || typeof isPinned !== "boolean") {
          return apiError("newsId and isPinned are required", 422);
        }
        const news = await db.news.update({
          where: { id: newsId },
          data: { isPinned },
        });
        await logAuditEvent({
          adminId: admin.id,
          action: "NEWS_UPDATE",
          targetType: "news",
          targetId: newsId,
          metadata: { isPinned },
          ipAddress: ip,
        });
        return apiSuccess(news);
      }

      case "delete_user": {
        const { userId } = data as { userId: string };
        if (!userId) return apiError("userId is required", 422);
        if (userId === admin.id) return apiError("Cannot delete your own account", 403);

        await db.user.update({
          where: { id: userId },
          data: { deletedAt: new Date(), isBanned: true },
        });
        await db.session.deleteMany({ where: { userId } });
        await logAuditEvent({
          adminId: admin.id,
          action: "USER_BAN",
          targetType: "user",
          targetId: userId,
          metadata: { deleted: true },
          ipAddress: ip,
        });
        return apiSuccess({ message: "User deleted" });
      }

      case "reset_password": {
        const { userId } = data as { userId: string };
        if (!userId) return apiError("userId is required", 422);

        const target = await db.user.findUnique({ where: { id: userId } });
        if (!target) return apiError("User not found", 404);

        const token = generateToken();
        await db.passwordResetToken.deleteMany({ where: { userId } });
        await db.passwordResetToken.create({
          data: {
            userId,
            token: hashToken(token),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        await logAuditEvent({
          adminId: admin.id,
          action: "SETTINGS_UPDATE",
          targetType: "user",
          targetId: userId,
          metadata: { action: "password_reset_issued" },
          ipAddress: ip,
        });

        return apiSuccess({
          message: "Password reset token generated",
          resetUrl: `/reset-password?token=${token}`,
        });
      }

      case "update_article": {
        const articleData = articleAdminSchema.parse(data);
        const { articleId, ...updates } = articleData;
        const article = await db.article.update({
          where: { id: articleId },
          data: {
            ...updates,
            ...(updates.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
          },
        });

        const auditAction =
          updates.status === "PUBLISHED"
            ? "CONTENT_APPROVE"
            : updates.status === "REJECTED"
              ? "CONTENT_REJECT"
              : updates.featured
                ? "CONTENT_FEATURE"
                : "CONTENT_APPROVE";

        await logAuditEvent({
          adminId: admin.id,
          action: auditAction,
          targetType: "article",
          targetId: articleId,
          ipAddress: ip,
        });

        if (updates.status === "REJECTED") {
          const author = await db.article.findUnique({
            where: { id: articleId },
            select: { authorId: true, title: true },
          });
          if (author) {
            await notifyModerationAction({
              userId: author.authorId,
              title: "Article rejected",
              message: `Your article "${author.title}" was not approved.`,
            });
          }
        }

        return apiSuccess(article);
      }

      case "delete_article": {
        const { articleId } = data as { articleId: string };
        if (!articleId) return apiError("articleId is required", 422);
        await db.article.delete({ where: { id: articleId } });
        await logAuditEvent({
          adminId: admin.id,
          action: "CONTENT_DELETE",
          targetType: "article",
          targetId: articleId,
          ipAddress: ip,
        });
        return apiSuccess({ message: "Article deleted" });
      }

      case "delete_discussion": {
        const { discussionId } = data as { discussionId: string };
        if (!discussionId) return apiError("discussionId is required", 422);
        await db.discussion.delete({ where: { id: discussionId } });
        await logAuditEvent({
          adminId: admin.id,
          action: "CONTENT_DELETE",
          targetType: "discussion",
          targetId: discussionId,
          ipAddress: ip,
        });
        return apiSuccess({ message: "Discussion deleted" });
      }

      case "lock_discussion": {
        const lockData = discussionAdminSchema.parse(data);
        const discussion = await db.discussion.update({
          where: { id: lockData.discussionId },
          data: { isLocked: lockData.isLocked ?? true },
        });
        await logAuditEvent({
          adminId: admin.id,
          action: "CONTENT_DELETE",
          targetType: "discussion",
          targetId: lockData.discussionId,
          metadata: { locked: lockData.isLocked ?? true },
          ipAddress: ip,
        });
        return apiSuccess(discussion);
      }

      case "delete_comment": {
        const commentData = commentAdminSchema.parse(data);
        await db.comment.update({
          where: { id: commentData.commentId },
          data: { isRemoved: true },
        });
        await logAuditEvent({
          adminId: admin.id,
          action: "CONTENT_DELETE",
          targetType: "comment",
          targetId: commentData.commentId,
          ipAddress: ip,
        });
        return apiSuccess({ message: "Comment removed" });
      }

      case "toggle_maintenance": {
        const { enabled } = data as { enabled: boolean };
        if (typeof enabled !== "boolean") {
          return apiError("enabled must be a boolean", 422);
        }
        await db.siteSetting.upsert({
          where: { key: "maintenance_mode" },
          create: { key: "maintenance_mode", value: String(enabled) },
          update: { value: String(enabled) },
        });
        invalidateSettingsCache("maintenance_mode");

        await logAuditEvent({
          adminId: admin.id,
          action: "MAINTENANCE_TOGGLE",
          metadata: { enabled },
          ipAddress: ip,
        });

        const response = apiSuccess({
          maintenanceMode: enabled,
          message: enabled
            ? "Maintenance mode enabled. Non-admin routes will redirect within 10 seconds."
            : "Maintenance mode disabled.",
        });
        response.cookies.set("nft_maintenance", enabled ? "1" : "0", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: enabled ? 60 * 60 * 24 * 365 : 0,
        });
        return response;
      }

      default:
        return apiError("Unknown action", 400, "INVALID_ACTION");
    }
  } catch (error) {
    return handleApiError(error);
  }
}

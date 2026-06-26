import { z } from "zod";
import { InterestCategory, PostCategory, ImportanceLevel, ReliabilityStatus, ContentStatus } from "@prisma/client";

export const newsCreateSchema = z.object({
  headline: z.string().min(5).max(300),
  summary: z.string().max(1000).optional(),
  content: z.string().max(10000).optional(),
  sourceId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  importance: z.nativeEnum(ImportanceLevel).default("MEDIUM"),
  reliabilityStatus: z.nativeEnum(ReliabilityStatus).default("UNVERIFIED"),
  assets: z
    .array(
      z.object({
        symbol: z.string().min(1).max(20),
        assetType: z.string().min(1).max(50),
      })
    )
    .optional(),
});

export const articleCreateSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(50).max(50000),
  category: z.nativeEnum(PostCategory),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const discussionCreateSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(20).max(10000),
  category: z.nativeEnum(PostCategory),
});

export const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().cuid().optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(["news", "article", "discussion", "comment", "user"]),
  targetId: z.string().cuid(),
  reason: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
});

export const interestsSchema = z.object({
  categories: z.array(z.nativeEnum(InterestCategory)).min(1).max(6),
});

export const searchSchema = z.object({
  q: z.string().max(200).optional().default(""),
  type: z.enum(["all", "news", "articles", "users", "discussions", "comments"]).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(["relevance", "newest"]).optional().default("newest"),
});

export const aiMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().min(1).max(4000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const adminActionSchema = z.object({
  action: z.enum([
    "create_news",
    "update_news",
    "delete_news",
    "pin_news",
    "update_user",
    "delete_user",
    "reset_password",
    "update_article",
    "delete_article",
    "delete_discussion",
    "lock_discussion",
    "delete_comment",
    "resolve_report",
    "toggle_maintenance",
  ]),
});

export const newsUpdateSchema = z.object({
  newsId: z.string().cuid(),
  headline: z.string().min(5).max(300).optional(),
  summary: z.string().max(1000).optional(),
  content: z.string().max(1000).optional(),
  importance: z.nativeEnum(ImportanceLevel).optional(),
  reliabilityStatus: z.nativeEnum(ReliabilityStatus).optional(),
  isPinned: z.boolean().optional(),
});

export const articleAdminSchema = z.object({
  articleId: z.string().cuid(),
  status: z.nativeEnum(ContentStatus).optional(),
  featured: z.boolean().optional(),
});

export const discussionAdminSchema = z.object({
  discussionId: z.string().cuid(),
  isLocked: z.boolean().optional(),
});

export const commentAdminSchema = z.object({
  commentId: z.string().cuid(),
});

export const resolveReportSchema = z.object({
  reportId: z.string().cuid(),
  status: z.enum(["RESOLVED", "DISMISSED"]),
});

export const adminUserUpdateSchema = z.object({
  userId: z.string().cuid().optional(),
  role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
  isSuspended: z.boolean().optional(),
  isBanned: z.boolean().optional(),
});

export const watchlistSchema = z.object({
  name: z.string().min(1).max(100),
  assets: z.array(
    z.object({
      symbol: z.string().min(1).max(20),
      type: z.string().min(1).max(50),
    })
  ),
});

import type { Role } from "@prisma/client";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: Role;
  avatar: string | null;
  bio: string | null;
  reputation: number;
  contributionCount: number;
  emailVerified: Date | null;
  twoFactorEnabled: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
}

export interface NewsWithRelations {
  id: string;
  headline: string;
  summary: string | null;
  importance: string;
  reliabilityStatus: string;
  publishedAt: Date;
  aiInterpretation: unknown;
  source: { name: string; reliabilityScore: number };
  category: { name: string; slug: string } | null;
  assets: { symbol: string; assetType: string }[];
  _count?: { comments: number; bookmarks: number };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

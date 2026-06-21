import { z } from "zod";
import { AssetCategory, AlertType, AlertChannel } from "@prisma/client";

export const watchlistCreateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.nativeEnum(AssetCategory).optional(),
});

export const watchlistItemSchema = z.object({
  symbol: z.string().min(1).max(20),
  assetType: z.string().min(1).max(50),
  category: z.nativeEnum(AssetCategory).default("STOCKS"),
});

export const watchlistReorderSchema = z.object({
  watchlistIds: z.array(z.string().cuid()).min(1),
});

export const itemReorderSchema = z.object({
  itemIds: z.array(z.string().cuid()).min(1),
});

export const priceAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  assetType: z.string().min(1).max(50),
  watchlistId: z.string().cuid().optional(),
  alertType: z.nativeEnum(AlertType),
  threshold: z.number().optional(),
  keyword: z.string().max(100).optional(),
  channels: z.nativeEnum(AlertChannel).default("IN_APP"),
});

export const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().max(20).optional(),
  assetType: z.string().max(50).optional(),
  alertType: z.nativeEnum(AlertType),
  threshold: z.number().optional(),
  keyword: z.string().max(100).optional(),
  channels: z.nativeEnum(AlertChannel).default("IN_APP"),
});

export const portfolioPositionSchema = z.object({
  portfolioId: z.string().cuid().optional(),
  symbol: z.string().min(1).max(20),
  assetType: z.string().min(1).max(50),
  category: z.nativeEnum(AssetCategory).default("STOCKS"),
  quantity: z.number().positive(),
  entryPrice: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const calendarQuerySchema = z.object({
  type: z.enum(["CPI", "NFP", "FOMC", "GDP", "UNEMPLOYMENT", "OTHER"]).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  timezone: z.string().optional(),
  country: z.string().optional(),
});

export const heatmapQuerySchema = z.object({
  category: z.enum(["STOCKS", "FOREX", "CRYPTO", "COMMODITIES", "INDICES"]).optional(),
});

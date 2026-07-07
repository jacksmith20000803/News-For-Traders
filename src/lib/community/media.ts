import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { CommunityMediaItem, CommunityMediaType } from "@/lib/community/media-types";

export const COMMUNITY_MEDIA_SETTING_KEY = "community_media_catalog";

const DEFAULT_MEDIA_DATE = "2026-01-01T00:00:00.000Z";

const DEFAULT_EMOJIS: Array<[string, string]> = [
  ["red_heart", "❤️"],
  ["thumbs_up", "👍"],
  ["thumbs_down", "👎"],
  ["fire", "🔥"],
  ["smiling_face", "😊"],
  ["clapping_hands", "👏"],
  ["beaming_face", "😁"],
  ["rocket", "🚀"],
  ["chart_up", "📈"],
  ["diamond", "💎"],
  ["eyes", "👀"],
  ["check_mark", "✅"],
  ["lightning", "⚡"],
  ["star", "⭐"],
  ["money_bag", "💰"],
  ["hundred_points", "💯"],
  ["party", "🥳"],
  ["thinking", "🤔"],
  ["salute", "🫡"],
  ["folded_hands", "🙏"],
  ["warning", "⚠️"],
  ["target", "🎯"],
  ["trophy", "🏆"],
  ["gem", "💠"],
  ["green_circle", "🟢"],
  ["red_circle", "🔴"],
  ["blue_circle", "🔵"],
  ["sparkles", "✨"],
  ["hourglass", "⏳"],
  ["locked", "🔒"],
  ["bell", "🔔"],
  ["megaphone", "📣"],
  ["memo", "📝"],
  ["mag", "🔍"],
  ["calendar", "📅"],
  ["briefcase", "💼"],
  ["computer", "💻"],
  ["mobile", "📱"],
  ["coffee", "☕"],
  ["sun", "☀️"],
  ["moon", "🌙"],
  ["wave", "👋"],
  ["ok_hand", "👌"],
  ["muscle", "💪"],
  ["handshake", "🤝"],
  ["shield", "🛡️"],
  ["bank", "🏦"],
  ["globe", "🌐"],
  ["alarm", "⏰"],
  ["hourglass_done", "⌛"],
];

const DEFAULT_MEDIA: CommunityMediaItem[] = [
  ...DEFAULT_EMOJIS.map(([name, value]) => ({
    id: `emoji_${name}`,
    type: "EMOJI" as const,
    name: name.replaceAll("_", " "),
    value,
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  })),
  {
    id: "sticker_bullish_chart_placeholder",
    type: "STICKER",
    name: "bullish chart placeholder",
    url: "/chart-bull-placeholder.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "sticker_bearish_chart_placeholder",
    type: "STICKER",
    name: "bearish chart placeholder",
    url: "/chart-bear-placeholder.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "sticker_tradx_logo_placeholder",
    type: "STICKER",
    name: "TRADX logo placeholder",
    url: "/tradx-logo.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "sticker_community_gallery_placeholder",
    type: "STICKER",
    name: "community gallery placeholder",
    url: "/promo/tradx-community-gallery-placeholder.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "gif_app_panel_placeholder",
    type: "GIF",
    name: "app panel GIF placeholder",
    url: "/promo/tradx-app-panel-overview.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "gif_bot_preview_placeholder",
    type: "GIF",
    name: "bot preview GIF placeholder",
    url: "/promo/tradx-bot-app-preview.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "gif_mobile_bot_placeholder",
    type: "GIF",
    name: "mobile bot GIF placeholder",
    url: "/promo/tradx-mobile-bot-preview.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
  {
    id: "gif_wall_street_partner_placeholder",
    type: "GIF",
    name: "wall street partner GIF placeholder",
    url: "/promo/tradx-wall-street-partner-placeholder.webp",
    createdAt: DEFAULT_MEDIA_DATE,
    updatedAt: DEFAULT_MEDIA_DATE,
  },
];

export async function getCommunityMediaCatalog() {
  const setting = await db.siteSetting.findUnique({
    where: { key: COMMUNITY_MEDIA_SETTING_KEY },
    select: { value: true },
  });

  if (!setting?.value) return DEFAULT_MEDIA;

  try {
    const parsed = JSON.parse(setting.value) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_MEDIA;
    const sanitized = parsed.map(sanitizeMediaItem).filter(Boolean) as CommunityMediaItem[];
    return sanitized.length ? sanitized : DEFAULT_MEDIA;
  } catch {
    return DEFAULT_MEDIA;
  }
}

export async function setCommunityMediaCatalog(items: CommunityMediaItem[]) {
  await db.siteSetting.upsert({
    where: { key: COMMUNITY_MEDIA_SETTING_KEY },
    create: { key: COMMUNITY_MEDIA_SETTING_KEY, value: JSON.stringify(items) },
    update: { value: JSON.stringify(items) },
  });
}

export async function addCommunityMediaItem(input: {
  type: CommunityMediaType;
  name: string;
  value?: string;
  url?: string;
}) {
  const now = new Date().toISOString();
  const item: CommunityMediaItem = {
    id: `media_${randomUUID()}`,
    type: input.type,
    name: input.name,
    value: input.value,
    url: input.url,
    createdAt: now,
    updatedAt: now,
  };
  const catalog = await getCommunityMediaCatalog();
  await setCommunityMediaCatalog([item, ...catalog]);
  return item;
}

export async function deleteCommunityMediaItems(ids: string[]) {
  const idSet = new Set(ids);
  const catalog = await getCommunityMediaCatalog();
  const next = catalog.filter((item) => !idSet.has(item.id));
  await setCommunityMediaCatalog(next);
  return catalog.length - next.length;
}

export async function getCommunityMediaItem(id: string) {
  const catalog = await getCommunityMediaCatalog();
  return catalog.find((item) => item.id === id) ?? null;
}

function sanitizeMediaItem(value: unknown): CommunityMediaItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CommunityMediaItem>;
  if (!item.id || !item.name || !item.type) return null;
  if (!["EMOJI", "STICKER", "GIF"].includes(item.type)) return null;
  if (item.type === "EMOJI" && !item.value) return null;
  if (item.type !== "EMOJI" && !item.url) return null;

  return {
    id: String(item.id),
    type: item.type,
    name: String(item.name),
    value: item.value ? String(item.value) : undefined,
    url: item.url ? String(item.url) : undefined,
    createdAt: item.createdAt ? String(item.createdAt) : DEFAULT_MEDIA_DATE,
    updatedAt: item.updatedAt ? String(item.updatedAt) : DEFAULT_MEDIA_DATE,
  };
}


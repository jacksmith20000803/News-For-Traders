export const COMMUNITY_PRESET_AVATARS = [
  "/coin-avatar/btc.webp",
  "/coin-avatar/eth.webp",
  "/coin-avatar/sol.webp",
  "/coin-avatar/bnb.webp",
  "/coin-avatar/avax.webp",
  "/coin-avatar/doge.webp",
  "/coin-avatar/link.webp",
  "/coin-avatar/xrp.webp",
];

export const COMMUNITY_PRESET_BADGES = [
  "/coin-backgrounds/btc.webp",
  "/coin-backgrounds/eth.webp",
  "/coin-backgrounds/sol.webp",
  "/coin-backgrounds/bnb.webp",
  "/coin-backgrounds/avax.webp",
  "/coin-backgrounds/doge.webp",
  "/coin-backgrounds/link.webp",
  "/coin-backgrounds/xrp.webp",
];

export function isCommunityPresetAsset(value: string, kind: "avatar" | "badge") {
  const list = kind === "avatar" ? COMMUNITY_PRESET_AVATARS : COMMUNITY_PRESET_BADGES;
  return list.includes(value);
}

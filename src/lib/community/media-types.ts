export type CommunityMediaType = "EMOJI" | "STICKER" | "GIF";

export type CommunityMediaItem = {
  id: string;
  type: CommunityMediaType;
  name: string;
  value?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
};


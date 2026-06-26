"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageCircle, TrendingUp, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import {
  IMPORTANCE_CONFIG,
  RELIABILITY_CONFIG,
  type AIInterpretation,
} from "@/lib/constants";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import { BookmarkButton, ShareButton } from "@/components/news/news-actions";
import { useState } from "react";

type ViewMode = "list" | "card";

// Helper function to validate image URLs
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Helper function to strip HTML tags
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
}

const DEFAULT_NEWS_IMAGE = "/default-news.jpg";

interface NewsCardProps {
  id: string;
  headline: string;
  summary?: string | null;
  source: string;
  publishedAt: Date | string;
  importance: ImportanceLevel;
  reliabilityStatus: ReliabilityStatus;
  assets: { symbol: string; assetType: string }[];
  aiInterpretation?: AIInterpretation | null;
  commentCount?: number;
  imageUrl?: string | null;
  layout?: "list" | "card";
  initialFavorite?: boolean;
  onFavoriteChange?: (newsId: string, saved: boolean) => void;
}

export function NewsCard({
  id,
  headline,
  summary,
  source,
  publishedAt,
  importance,
  reliabilityStatus,
  assets,
  aiInterpretation,
  commentCount = 0,
  imageUrl,
  layout = "list",
  initialFavorite = false,
  onFavoriteChange,
}: NewsCardProps) {
  const importanceConfig = IMPORTANCE_CONFIG[importance];
  const reliabilityConfig = RELIABILITY_CONFIG[reliabilityStatus];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const viewMode: ViewMode = layout;

  const displayImageUrl = (isValidImageUrl(imageUrl) && !imageError ? imageUrl : DEFAULT_NEWS_IMAGE) as string;
  const showImage = true;

  if (viewMode === "card") {
    return (
      <article className="news-item-card dash-panel p-4 group hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
        {showImage && (
          <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-white/5">
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-white/10" />
            )}
            <Image
              src={displayImageUrl}
              alt={headline}
              width={1536}
              height={864}
              className="news-card-image h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
              priority={false}
            />
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge className={importanceConfig.bg + " " + importanceConfig.color}>
            {importanceConfig.label}
          </Badge>
          <Badge variant="outline" className={reliabilityConfig.color}>
            {reliabilityConfig.label}
          </Badge>
        </div>
        <Link href={`/news/${id}`}>
          <h3 className="text-sm font-semibold leading-snug transition-colors group-hover:text-cyan-400 line-clamp-2">
            {headline}
          </h3>
        </Link>
        {summary && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{stripHtml(summary)}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{source}</span>
            <span className="mx-1.5">·</span>
            {formatRelative(publishedAt)}
          </div>
          <div className="flex items-center gap-0.5">
            <BookmarkButton newsId={id} initialSaved={initialFavorite} onChange={onFavoriteChange} />
            <ShareButton headline={headline} url={`/news/${id}`} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="news-item-card group rounded-xl border border-white/6 bg-white/[0.02] p-4 transition-all duration-300 hover:border-cyan-500/20 hover:bg-white/[0.04] hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-0.5 animate-fade-in flex gap-4 relative overflow-hidden" suppressHydrationWarning>
      {showImage && (
        <div className="relative h-24 w-36 shrink-0 self-start overflow-hidden rounded-lg bg-white/5 shadow-lg">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-white/10" />
          )}
          <Image
            src={displayImageUrl}
            alt={headline}
            fill
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-1"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
            priority={false}
            quality={85}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2" suppressHydrationWarning>
          <Badge className={importanceConfig.bg + " " + importanceConfig.color}>
            {importanceConfig.label}
          </Badge>
          <Badge variant="outline" className={reliabilityConfig.color}>
            {reliabilityConfig.label}
          </Badge>
          {assets.slice(0, 3).map((asset) => (
            <Badge key={`${id}-${asset.symbol}`} variant="primary">
              {asset.symbol}
            </Badge>
          ))}
        </div>

        <Link href={`/news/${id}`}>
          <h3 className="text-sm font-semibold leading-snug transition-colors group-hover:text-cyan-400">
            {headline}
          </h3>
        </Link>

        {summary && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{stripHtml(summary)}</p>
        )}

        {aiInterpretation && (
          <div className="mt-3 rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              <TrendingUp className="h-3 w-3" />
              AI Insight
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {aiInterpretation.summary}
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between" suppressHydrationWarning>
          <div className="text-[10px] text-muted-foreground" suppressHydrationWarning>
            <span className="font-medium text-foreground/80">{source}</span>
            <span className="mx-1.5">·</span>
            {formatRelative(publishedAt)}
          </div>
          <div className="flex items-center gap-0.5" suppressHydrationWarning>
            <BookmarkButton newsId={id} initialSaved={initialFavorite} onChange={onFavoriteChange} />
            <ShareButton headline={headline} url={`/news/${id}`} />
            <Link
              href={`/news/${id}#comments`}
              className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              {commentCount > 0 && <span className="text-[10px]">{commentCount}</span>}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

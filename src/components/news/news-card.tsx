import Link from "next/link";
import { MessageCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import {
  IMPORTANCE_CONFIG,
  RELIABILITY_CONFIG,
  type AIInterpretation,
} from "@/lib/constants";
import type { ImportanceLevel, ReliabilityStatus } from "@prisma/client";
import { BookmarkButton, ShareButton } from "@/components/news/news-actions";

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
}: NewsCardProps) {
  const importanceConfig = IMPORTANCE_CONFIG[importance];
  const reliabilityConfig = RELIABILITY_CONFIG[reliabilityStatus];

  return (
    <article className="group rounded-xl border border-white/6 bg-white/[0.02] p-4 transition-all hover:border-cyan-500/20 hover:bg-white/[0.04] animate-fade-in">
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{summary}</p>
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

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{source}</span>
          <span className="mx-1.5">·</span>
          {formatRelative(publishedAt)}
        </div>
        <div className="flex items-center gap-0.5">
          <BookmarkButton newsId={id} />
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
    </article>
  );
}

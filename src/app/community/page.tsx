import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ArrowUp, ArrowDown } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { COMMUNITY_RULES, POST_CATEGORY_LABELS } from "@/lib/constants";
import type { PostCategory } from "@prisma/client";
import { isDatabaseConnectivityError } from "@/lib/db-errors";

export const metadata = { title: "Community" };

type CommunityDiscussion = {
  id: string;
  title: string;
  content: string;
  category: PostCategory;
  isPinned: boolean;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
  author: { id: string; name: string; reputation: number };
  _count: { comments: number };
};

async function getDiscussions(): Promise<CommunityDiscussion[]> {
  try {
    return await db.discussion.findMany({
      include: {
        author: { select: { id: true, name: true, reputation: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;

    return [
      {
        id: "fallback-community-reconnecting",
        title: "Community feed is reconnecting",
        content:
          "Live discussions are temporarily unavailable. The page will automatically use the latest community posts when the database connection returns.",
        category: "RISK_MANAGEMENT",
        isPinned: false,
        upvoteCount: 0,
        downvoteCount: 0,
        createdAt: new Date(),
        author: { id: "system", name: "TRADX", reputation: 100 },
        _count: { comments: 0 },
      },
    ];
  }
}

export default async function CommunityPage() {
  await connection();

  const discussions = await getDiscussions();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Community Discussions</h1>
          </div>
          <p className="text-muted-foreground">
            Professional discussion for high-quality market analysis and debate.
          </p>
        </div>
        <Link
          href="/community/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start Discussion
        </Link>
      </div>

      <Card className="mb-8 border-accent/30 bg-accent/5">
        <CardHeader>
          <CardTitle className="text-base">Community Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
            {COMMUNITY_RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                {rule}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {discussions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No discussions yet. Be the first to start a conversation.
            </CardContent>
          </Card>
        ) : (
          discussions.map((d) => (
            <Card key={d.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="flex gap-4 p-5">
                <div className="flex flex-col items-center gap-1 text-muted-foreground min-w-[40px]">
                  <ArrowUp className="h-4 w-4" />
                  <span className="text-sm font-medium">{d.upvoteCount - d.downvoteCount}</span>
                  <ArrowDown className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">
                      {POST_CATEGORY_LABELS[d.category as PostCategory]}
                    </Badge>
                    {d.isPinned && <Badge variant="warning">Pinned</Badge>}
                  </div>
                  <Link href={`/community/${d.id}`}>
                    <h3 className="font-semibold hover:text-primary transition-colors">
                      {d.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{d.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{d.author.name} · Rep {d.author.reputation}</span>
                    <span>{formatRelative(d.createdAt)}</span>
                    <span>{d._count.comments} comments</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { POST_CATEGORY_LABELS } from "@/lib/constants";
import { formatRelative } from "@/lib/utils";
import { CommentSection } from "@/components/content/comment-section";
import { DiscussionVoteButtons } from "@/components/community/vote-buttons";
import type { PostCategory } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

export default async function DiscussionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  const discussion = await db.discussion.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, reputation: true } },
      comments: {
        where: { parentId: null, isRemoved: false },
        include: {
          author: { select: { id: true, name: true, reputation: true } },
          replies: {
            where: { isRemoved: false },
            include: { author: { select: { id: true, name: true, reputation: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!discussion) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to community
      </Link>

      <div className="flex gap-4">
        <DiscussionVoteButtons
          discussionId={discussion.id}
          upvotes={discussion.upvoteCount}
          downvotes={discussion.downvoteCount}
          locked={discussion.isLocked}
        />
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <Badge variant="outline">
              {POST_CATEGORY_LABELS[discussion.category as PostCategory]}
            </Badge>
            {discussion.isPinned && <Badge variant="warning">Pinned</Badge>}
            {discussion.isLocked && <Badge variant="danger">Locked</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{discussion.title}</h1>
          <p className="text-sm text-muted-foreground">
            {discussion.author.name} · Rep {discussion.author.reputation} ·{" "}
            {formatRelative(discussion.createdAt)}
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {discussion.content}
          </div>

          <section className="pt-6 border-t border-border">
            <h2 className="text-lg font-semibold mb-4">Comments</h2>
            <CommentSection
              discussionId={discussion.id}
              locked={discussion.isLocked}
              comments={discussion.comments.map((c) => ({
                ...c,
                createdAt: c.createdAt.toISOString(),
                replies: c.replies.map((r) => ({
                  ...r,
                  createdAt: r.createdAt.toISOString(),
                })),
              }))}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

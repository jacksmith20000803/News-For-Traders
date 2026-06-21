"use client";

import { useState } from "react";
import { secureFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { clientId } from "@/lib/client-id";

interface CommentAuthor {
  id: string;
  name: string;
  reputation: number;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
  replies?: Comment[];
}

interface CommentSectionProps {
  newsId?: string;
  articleId?: string;
  discussionId?: string;
  comments: Comment[];
  locked?: boolean;
}

export function CommentSection({
  newsId,
  articleId,
  discussionId,
  comments: initial,
  locked,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initial);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await secureFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content,
          newsId,
          articleId,
          discussionId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to post comment");
        return;
      }
      setComments((prev) => [
        {
          id: json.data.id ?? clientId("comment"),
          content: json.data.content,
          createdAt: json.data.createdAt ?? new Date().toISOString(),
          author: { id: "", name: "You", reputation: 0 },
          replies: [],
        },
        ...prev,
      ]);
      setContent("");
    } catch {
      setError("Sign in with a verified email to comment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="space-y-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={submit} isLoading={loading} disabled={!content.trim()}>
            Post comment
          </Button>
        </div>
      )}

      {locked && (
        <p className="text-sm text-muted-foreground">This discussion is locked.</p>
      )}

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span className="font-medium text-foreground">{c.author.name}</span>
                <span>Rep {c.author.reputation}</span>
                <span>·</span>
                <span>{formatRelative(c.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              {c.replies && c.replies.length > 0 && (
                <div className="mt-3 ml-4 space-y-3 border-l border-border pl-4">
                  {c.replies.map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{r.author.name}</span>
                        <span>{formatRelative(r.createdAt)}</span>
                      </div>
                      <p className="text-sm">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

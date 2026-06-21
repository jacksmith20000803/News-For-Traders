"use client";

import { useState } from "react";
import { secureFetch } from "@/lib/api/client";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscussionVoteButtonsProps {
  discussionId: string;
  upvotes: number;
  downvotes: number;
  locked?: boolean;
}

export function DiscussionVoteButtons({
  discussionId,
  upvotes: initialUp,
  downvotes: initialDown,
  locked,
}: DiscussionVoteButtonsProps) {
  const [score, setScore] = useState(initialUp - initialDown);
  const [loading, setLoading] = useState(false);

  const vote = async (value: 1 | -1) => {
    if (locked || loading) return;
    setLoading(true);
    try {
      const res = await secureFetch(`/api/discussions/${discussionId}/vote`, {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setScore(json.data.upvoteCount - json.data.downvoteCount);
      }
    } catch {
      // not signed in
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px]">
      <button
        onClick={() => vote(1)}
        disabled={locked || loading}
        className={cn(
          "rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-accent",
          locked && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Upvote"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold font-mono">{score}</span>
      <button
        onClick={() => vote(-1)}
        disabled={locked || loading}
        className={cn(
          "rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-destructive",
          locked && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Downvote"
      >
        <ArrowDown className="h-5 w-5" />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POST_CATEGORY_LABELS } from "@/lib/constants";
import type { PostCategory } from "@prisma/client";

export default function NewDiscussionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PostCategory>("MACRO");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await secureFetch("/api/discussions", {
        method: "POST",
        body: JSON.stringify({ title, content, category }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to create discussion");
        return;
      }
      router.push(`/community/${json.data.id}`);
    } catch {
      setError("Please sign in with a verified email to post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/community" className="text-sm text-primary hover:underline mb-4 inline-block">
        ← Back to community
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Start a Discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              className="btn-3d w-full rounded-lg border border-border bg-card px-3 py-2 text-sm appearance-none cursor-pointer"
            >
              {Object.entries(POST_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              placeholder="Share your analysis or question…"
            />
          </div>
          <Button onClick={submit} isLoading={loading} disabled={!title.trim() || content.length < 20}>
            Publish Discussion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

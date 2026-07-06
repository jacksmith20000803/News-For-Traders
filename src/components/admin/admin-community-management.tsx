"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Search, ShieldCheck, XCircle, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { CommunityStatus } from "@prisma/client";

type CommunityAdminItem = {
  id: string;
  name: string;
  slug: string;
  topic: string;
  rules: string;
  avatarUrl: string | null;
  badgeUrl: string | null;
  status: CommunityStatus;
  rejectionReason: string | null;
  owner: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    avatar: string | null;
    country: string | null;
  };
  approvedBy: { id: string; name: string } | null;
  memberCount: number;
  messageCount: number;
  createdAt: string;
  approvedAt: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const statuses: Array<CommunityStatus | "ALL"> = ["PENDING", "APPROVED", "REJECTED", "ARCHIVED", "ALL"];

export function AdminCommunityManagement({ initialItems }: { initialItems: CommunityAdminItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<CommunityStatus | "ALL">("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        status,
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      const response = await fetch(`/api/admin/communities?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<ApiResponse<{ items: CommunityAdminItem[] }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load communities");
      setItems(json.data.items);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load communities");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadItems]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: "approve" | "reject" | "archive") {
    if (!selectedIds.size) {
      setMessage("Select at least one community first.");
      return;
    }
    const reason =
      action === "approve" ? undefined : window.prompt(`Reason for ${action === "reject" ? "rejecting" : "archiving"} selected communities:`)?.trim();
    if (action !== "approve" && !reason) {
      setMessage("A reason is required.");
      return;
    }

    setLoading(true);
    setMessage("Processing community request...");
    try {
      const response = await secureFetch("/api/admin/communities", {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds), action, reason }),
      });
      const json = await readJsonResponse<ApiResponse<{ updated: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Action failed");
      setMessage(`Updated ${json.data?.updated ?? 0} communit${json.data?.updated === 1 ? "y" : "ies"}.`);
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadItems();
              }}
              className="relative max-w-xl flex-1"
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search community, owner, or topic"
                className="h-11 w-full rounded-2xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </form>
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as CommunityStatus | "ALL")}
                className="select-polished h-10 px-3 text-sm"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "All statuses" : item.toLowerCase()}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadItems()}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={() => void runAction("approve")} className="bg-emerald-600 text-white hover:bg-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void runAction("reject")}>
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void runAction("archive")}>
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{items.length} communities loaded</span>
            <span>{selectedIds.size} selected</span>
          </div>

          {message ? (
            <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              "grid gap-4 rounded-[1.4rem] border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 lg:grid-cols-[220px_minmax(0,1fr)_240px]",
              selectedIds.has(item.id) && "border-primary/70 ring-2 ring-primary/20"
            )}
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <div
                className="h-28 bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500 bg-cover bg-center"
                style={item.badgeUrl ? { backgroundImage: `url(${item.badgeUrl})` } : undefined}
              />
              <div className="relative p-3 pt-8">
                <Avatar url={item.avatarUrl} name={item.name} />
                <p className="line-clamp-1 text-sm font-black">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.memberCount} members</p>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  className="h-4 w-4 accent-primary"
                  aria-label={`Select ${item.name}`}
                />
                <Badge variant={statusVariant(item.status)}>{item.status.toLowerCase()}</Badge>
                <Badge variant="outline">{item.slug}</Badge>
              </div>
              <h3 className="line-clamp-1 text-lg font-black">{item.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.topic}</p>
              <div className="mt-3 rounded-2xl border border-border bg-background/70 p-3">
                <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Rules</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-foreground">{item.rules}</p>
              </div>
              {item.rejectionReason ? (
                <p className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                  {item.rejectionReason}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-3">
              <div className="flex items-center gap-3">
                <Avatar url={item.owner.avatar} name={item.owner.name} small />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{item.owner.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.owner.email}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="rounded-xl bg-muted px-2 py-2">{item.messageCount} messages</span>
                <span className="rounded-xl bg-muted px-2 py-2">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              {item.approvedBy ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {item.approvedBy.name}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!items.length && !loading ? (
        <Card className="bg-card/95">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No communities match the current filters.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Avatar({ url, name, small }: { url: string | null; name: string; small?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500 text-xs font-black text-white",
        small ? "h-10 w-10" : "absolute -top-7 left-3 h-14 w-14 border-4 border-background"
      )}
      style={url ? { backgroundImage: `url(${url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
    >
      {!url ? name.slice(0, 2).toUpperCase() : null}
    </span>
  );
}

function statusVariant(status: CommunityStatus) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "ARCHIVED") return "danger";
  return "warning";
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Globe2,
  LayoutGrid,
  List,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag, countryDisplayName } from "@/components/ui/country-flag";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type IpRiskRow = {
  vpnDetected: boolean;
  vpnProvider: string | null;
  ipAsn: string | null;
  ipCompany: string | null;
  ipRiskSource: string | null;
  ipRiskCheckedAt: string | null;
};

type DownloadStatusValue = "not_downloaded" | "downloaded" | "installed";

type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  country: string | null;
  timezone: string | null;
  role: Role;
  isSuspended: boolean;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  registrationAudit: {
    ipAddress: string | null;
    country: string | null;
    city: string | null;
    browser: string | null;
    deviceType: string | null;
    os: string | null;
    userAgent: string | null;
    registeredAt: string;
    vpnDetected: boolean;
    vpnProvider: string | null;
    ipAsn: string | null;
    ipCompany: string | null;
    ipRiskSource: string | null;
    ipRiskCheckedAt: string | null;
  } | null;
  latestActivity: {
    ipAddress: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
    browser: string | null;
    deviceType: string | null;
    os: string | null;
    userAgent: string | null;
    createdAt: string;
    vpnDetected: boolean;
    vpnProvider: string | null;
    ipAsn: string | null;
    ipCompany: string | null;
    ipRiskSource: string | null;
    ipRiskCheckedAt: string | null;
  } | null;
  ipRisk: IpRiskRow;
  hasDownloaded: boolean;
  downloadStatus: DownloadStatusValue;
};

type VisitorRow = {
  id: string;
  visitorId: string;
  name: string;
  username: string;
  email: null;
  avatar: null;
  ipAddress: string | null;
  ipRisk: IpRiskRow;
  location: {
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
  };
  device: {
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    userAgent: string | null;
  };
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  activityCount: number;
  hasDownloaded: boolean;
  downloadStatus: DownloadStatusValue;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type UsersListData = {
  kind: "users" | "visitors";
  users: AdminUserRow[];
  visitors: VisitorRow[];
  pagination: { page: number; totalPages: number; total: number };
};

type Kind = "users" | "visitors";
type View = "list" | "grid";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function countryFlag(country: string | null | undefined) {
  if (!country || country.length !== 2) return "🌐";
  const codePoints = country
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function userLocation(user: AdminUserRow) {
  const country = user.latestActivity?.country ?? user.country ?? user.registrationAudit?.country ?? null;
  const region = user.latestActivity?.region ?? null;
  const city = user.latestActivity?.city ?? user.registrationAudit?.city;
  countryFlag(country);
  return [countryDisplayName(country), region, city].filter(Boolean).join(", ");
}

function visitorLocation(visitor: VisitorRow) {
  return [
    countryDisplayName(visitor.location.country),
    visitor.location.region,
    visitor.location.city,
  ]
    .filter(Boolean)
    .join(", ");
}

function userCountryCode(user: AdminUserRow) {
  return user.latestActivity?.country ?? user.country ?? user.registrationAudit?.country ?? null;
}

function userIpAddress(user: AdminUserRow) {
  return user.latestActivity?.ipAddress ?? user.registrationAudit?.ipAddress ?? "IP unavailable";
}

function userDevice(user: AdminUserRow) {
  return [
    user.latestActivity?.deviceType ?? user.registrationAudit?.deviceType,
    user.latestActivity?.browser ?? user.registrationAudit?.browser,
    user.latestActivity?.os ?? user.registrationAudit?.os,
  ]
    .filter(Boolean)
    .join(" / ");
}

function userStatus(user: AdminUserRow) {
  if (user.isBanned) return { label: "Banned", variant: "danger" as const };
  if (user.isSuspended) return { label: "Suspended", variant: "warning" as const };
  return { label: "Active", variant: "success" as const };
}

function vpnRiskLabel(risk: IpRiskRow | null | undefined, ipAddress?: string | null, location?: string | null) {
  if (!risk?.vpnDetected) return null;
  const provider = risk.vpnProvider || risk.ipCompany || risk.ipAsn || "Unknown";
  const detail = [ipAddress, location].filter(Boolean).join(", ");
  return detail ? `${provider} USING (${detail})` : `${provider} USING`;
}

function isRowActionTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("a,button,input,select,textarea,label,[data-row-action]"))
    : false;
}

export function AdminUsersTable() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("users");
  const [view, setView] = useState<View>("list");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const requestInFlightRef = useRef(false);

  const loadRows = useCallback(async (nextPage: number, nextKind = kind, q = activeQuery, showLoading = true) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (showLoading) setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        kind: nextKind,
        page: String(nextPage),
        limit: "12",
        ...(q ? { q } : {}),
      });
      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<UsersListData>>(res);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load records");
      setUsers(Array.isArray(json.data.users) ? json.data.users : []);
      setVisitors(Array.isArray(json.data.visitors) ? json.data.visitors : []);
      if (showLoading) setSelectedIds(new Set());
      setPage(json.data.pagination.page);
      setTotalPages(json.data.pagination.totalPages);
      setTotalRows(json.data.pagination.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load records");
    } finally {
      requestInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [activeQuery, kind]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      void loadRows(page, kind, activeQuery);
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void loadRows(page, kind, activeQuery, false);
    }, 1_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [activeQuery, kind, loadRows, page]);

  const stats = useMemo(() => {
    const active = users.filter((user) => !user.isBanned && !user.isSuspended).length;
    const risky = users.filter((user) => user.isBanned || user.isSuspended).length;
    const admin = users.filter((user) => user.role === "ADMIN").length;
    return { active, risky, admin };
  }, [users]);

  function changeKind(nextKind: Kind) {
    setKind(nextKind);
    setPage(1);
    void loadRows(1, nextKind, activeQuery);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    setActiveQuery(trimmed);
    setPage(1);
    void loadRows(1, kind, trimmed);
  }

  const rowCountLabel = kind === "users" ? "registered users" : "tracked visitors";
  const visibleIds = useMemo(
    () =>
      kind === "users"
        ? (users ?? []).map((user) => user.id)
        : (visitors ?? []).map((visitor) => visitor.visitorId),
    [kind, users, visitors]
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function deleteRecords(ids: string[]) {
    if (ids.length === 0) return;
    const label = kind === "users" ? "account" : "visitor log";
    if (!confirm(`Delete ${ids.length} ${label}${ids.length === 1 ? "" : "s"}?`)) return;

    setDeleting(true);
    setMessage("");
    try {
      const res = await secureFetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ kind, ids }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted?: number; message?: string }>>(res);
      if (!json.success) throw new Error(json.error ?? "Delete failed");
      setMessage(json.data?.message ?? `Deleted ${json.data?.deleted ?? ids.length} records.`);
      setSelectedIds(new Set());
      await loadRows(page, kind, activeQuery);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-card to-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                {kind === "users" ? <Users className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">People Intelligence</h2>
                <p className="text-sm text-muted-foreground">
                  Browse {rowCountLabel}, device snapshots, locations, and activity trails.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-xl border border-border bg-background/70 px-3 py-2">
                <strong className="mr-1 text-foreground">{totalRows}</strong>
                total
              </span>
              {kind === "users" ? (
                <>
                  <span className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <strong className="mr-1 text-success">{stats.active}</strong>
                    active on page
                  </span>
                  <span className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <strong className="mr-1 text-danger">{stats.risky}</strong>
                    restricted
                  </span>
                  <span className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <strong className="mr-1 text-primary">{stats.admin}</strong>
                    admins
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={kind}
                onChange={(event) => changeKind(event.target.value as Kind)}
                className="select-polished h-10 min-w-36 px-4 text-sm font-semibold"
                aria-label="Choose user management mode"
              >
                <option value="users">Users</option>
                <option value="visitors">Visitors</option>
              </select>
              <div className="flex rounded-2xl border border-border bg-card/95 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "rounded-xl bg-background/70 px-3 py-2 text-sm transition-all hover:bg-primary/10 hover:text-primary",
                    view === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "rounded-xl bg-background/70 px-3 py-2 text-sm transition-all hover:bg-primary/10 hover:text-primary",
                    view === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={submitSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:w-[520px]">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={kind === "users" ? "Search name, email, username..." : "Search visitor, country, browser..."}
                  className="h-10 w-full rounded-2xl border border-border bg-card/95 pl-10 pr-3 text-sm outline-none shadow-inner transition-colors hover:border-primary/40 focus:border-primary"
                />
              </div>
              <Button type="submit" size="sm" className="h-10">
                Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10"
                onClick={() => void loadRows(page, kind, activeQuery)}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mx-5 mt-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {message}
        </div>
      ) : null}

      <div className="p-5">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-background/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Select all visible
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={selectedIds.size === 0 || deleting}
              isLoading={deleting}
              onClick={() => void deleteRecords(Array.from(selectedIds))}
            >
              <Trash2 className="h-4 w-4" />
              Bulk delete
            </Button>
          </div>
        </div>

        {loading && !users.length && !visitors.length ? (
          <div className={cn("grid gap-3", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
        ) : kind === "users" ? (
          <RecordsLayout view={view}>
            {users.map((user) => (
              <UserRecord
                key={user.id}
                user={user}
                view={view}
                selected={selectedIds.has(user.id)}
                onSelect={() => toggleSelected(user.id)}
                onDelete={() => void deleteRecords([user.id])}
                onOpen={() => router.push(`/admin/users/${user.id}`)}
                deleting={deleting}
              />
            ))}
          </RecordsLayout>
        ) : (
          <RecordsLayout view={view}>
            {visitors.map((visitor) => (
              <VisitorRecord
                key={visitor.id}
                visitor={visitor}
                view={view}
                selected={selectedIds.has(visitor.visitorId)}
                onSelect={() => toggleSelected(visitor.visitorId)}
                onDelete={() => void deleteRecords([visitor.visitorId])}
                onOpen={() => router.push(`/admin/users/${encodeURIComponent(visitor.visitorId)}?kind=visitor`)}
                deleting={deleting}
              />
            ))}
          </RecordsLayout>
        )}

        {!loading && kind === "users" && users.length === 0 ? <EmptyState label="No users found." /> : null}
        {!loading && kind === "visitors" && visitors.length === 0 ? <EmptyState label="No visitors found yet." /> : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
          {loading && (users.length > 0 || visitors.length > 0) ? " - refreshing" : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecordsLayout({ view, children }: { view: View; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-3", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "")}>
      {children}
    </div>
  );
}

function UserRecord({
  user,
  view,
  selected,
  onSelect,
  onDelete,
  onOpen,
  deleting,
}: {
  user: AdminUserRow;
  view: View;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onOpen: () => void;
  deleting: boolean;
}) {
  const status = userStatus(user);
  const location = userLocation(user) || "Location unknown";
  const device = userDevice(user);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (!isRowActionTarget(event.target)) onOpen();
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !isRowActionTarget(event.target)) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border border-border bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
        selected && "border-primary/60 bg-primary/5 shadow-[0_18px_44px_rgba(16,185,129,0.12)]",
        view === "list" && "grid gap-4 lg:grid-cols-[auto_minmax(260px,1.2fr)_minmax(220px,1fr)_auto] lg:items-center"
      )}
    >
      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-border accent-primary"
          aria-label={`Select ${user.name}`}
        />
        {view === "grid" ? "Select" : null}
      </label>

      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <Avatar name={user.name} src={user.avatar} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.username ? `@${user.username}` : "No username"}
          </p>
          <VpnRiskBadge risk={user.ipRisk} ipAddress={userIpAddress(user)} location={location} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground lg:mt-0">
        <span className="flex min-w-0 items-center gap-2">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{user.email}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <CountryFlag countryCode={userCountryCode(user)} className="h-5 w-5" />
          <span className="truncate">{location}</span>
        </span>
        <span className="truncate text-xs font-mono">{userIpAddress(user)}</span>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">Registered {formatDate(user.registrationAudit?.registeredAt ?? user.createdAt)}</span>
        </span>
        {device ? <span className="truncate text-xs">{device}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0 lg:justify-end">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
        <DownloadStatus status={user.downloadStatus ?? (user.hasDownloaded ? "downloaded" : "not_downloaded")} />
        <ButtonLink href={`/admin/users/${user.id}`} label="See Details" />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={onDelete}
          className="h-9 rounded-xl text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Account Delete
        </Button>
      </div>
    </article>
  );
}

function VisitorRecord({
  visitor,
  view,
  selected,
  onSelect,
  onDelete,
  onOpen,
  deleting,
}: {
  visitor: VisitorRow;
  view: View;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onOpen: () => void;
  deleting: boolean;
}) {
  const location = visitorLocation(visitor) || "Location unknown";
  const device = [visitor.device.deviceType, visitor.device.browser, visitor.device.os].filter(Boolean).join(" / ");

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (!isRowActionTarget(event.target)) onOpen();
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !isRowActionTarget(event.target)) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border border-border bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
        selected && "border-primary/60 bg-primary/5 shadow-[0_18px_44px_rgba(16,185,129,0.12)]",
        view === "list" && "grid gap-4 lg:grid-cols-[auto_minmax(260px,1.2fr)_minmax(220px,1fr)_auto] lg:items-center"
      )}
    >
      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-border accent-primary"
          aria-label={`Select visitor ${visitor.visitorId}`}
        />
        {view === "grid" ? "Select" : null}
      </label>

      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-base font-semibold text-foreground">Visitor {visitor.visitorId.slice(0, 8)}</p>
          <p className="truncate text-xs text-muted-foreground">{visitor.ipAddress ?? "IP unavailable"}</p>
          <VpnRiskBadge risk={visitor.ipRisk} ipAddress={visitor.ipAddress} location={location} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground lg:mt-0">
        <span className="flex min-w-0 items-center gap-2">
          <CountryFlag countryCode={visitor.location.country} className="h-5 w-5" />
          <span className="truncate">{location}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">Last seen {formatDate(visitor.lastSeenAt)}</span>
        </span>
        <span className="truncate text-xs">{device || visitor.device.userAgent || "Unknown device"}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0 lg:justify-end">
        <Badge variant="primary">{visitor.activityCount} events</Badge>
        <DownloadStatus status={visitor.downloadStatus ?? (visitor.hasDownloaded ? "downloaded" : "not_downloaded")} />
        <ButtonLink href={`/admin/users/${encodeURIComponent(visitor.visitorId)}?kind=visitor`} label="See Details" />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={onDelete}
          className="h-9 rounded-xl text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Account Delete
        </Button>
      </div>
    </article>
  );
}

function VpnRiskBadge({ risk, ipAddress, location }: { risk: IpRiskRow | null | undefined; ipAddress?: string | null; location?: string | null }) {
  const label = vpnRiskLabel(risk, ipAddress, location);
  if (!label) return null;

  return (
    <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-red-600/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-red-600 ring-1 ring-red-500/30 dark:bg-red-500/15 dark:text-red-300">
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
      {initials(name)}
    </div>
  );
}

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-95"
    >
      <Shield className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function DownloadStatus({ status }: { status: DownloadStatusValue }) {
  const config = {
    not_downloaded: {
      label: "Not downloaded",
      title: "No trading bot download recorded",
      className: "bg-red-600 text-white ring-red-400/40",
      iconClassName: "bg-red-500 text-white ring-1 ring-red-200/70",
      icon: <X className="h-3.5 w-3.5" />,
    },
    downloaded: {
      label: "Downloaded",
      title: "Trading bot download recorded",
      className: "bg-blue-600 text-white ring-blue-400/40",
      iconClassName: "bg-blue-500 text-white ring-1 ring-blue-200/70",
      icon: <Download className="h-3.5 w-3.5" />,
    },
    installed: {
      label: "Installed",
      title: "Trading bot install recorded",
      className: "bg-emerald-600 text-white ring-emerald-400/40",
      iconClassName: "bg-emerald-500 text-white ring-1 ring-emerald-200/70",
      icon: <Check className="h-3.5 w-3.5" />,
    },
  }[status];

  return (
    <span
      className={cn("inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold ring-1", config.className)}
      title={config.title}
    >
      <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", config.iconClassName)}>
        {config.icon}
      </span>
      {config.label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
      <UserRound className="mx-auto mb-3 h-8 w-8 opacity-50" />
      {label}
    </div>
  );
}

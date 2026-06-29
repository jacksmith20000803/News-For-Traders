"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

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
  } | null;
};

type VisitorRow = {
  id: string;
  visitorId: string;
  name: string;
  username: string;
  email: null;
  avatar: null;
  ipAddress: string | null;
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
  const country = user.country ?? user.registrationAudit?.country ?? null;
  const city = user.registrationAudit?.city;
  return [countryFlag(country), country, city].filter(Boolean).join(" ");
}

function visitorLocation(visitor: VisitorRow) {
  return [
    countryFlag(visitor.location.country),
    visitor.location.country,
    visitor.location.region,
    visitor.location.city,
  ]
    .filter(Boolean)
    .join(" ");
}

function userStatus(user: AdminUserRow) {
  if (user.isBanned) return { label: "Banned", variant: "danger" as const };
  if (user.isSuspended) return { label: "Suspended", variant: "warning" as const };
  return { label: "Active", variant: "success" as const };
}

export function AdminUsersTable() {
  const [kind, setKind] = useState<Kind>("users");
  const [view, setView] = useState<View>("list");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async (nextPage: number, nextKind = kind, q = activeQuery) => {
    setLoading(true);
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
      setUsers(json.data.users);
      setVisitors(json.data.visitors);
      setPage(json.data.pagination.page);
      setTotalPages(json.data.pagination.totalPages);
      setTotalRows(json.data.pagination.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [activeQuery, kind]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      void loadRows(page, kind, activeQuery);
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void loadRows(page, kind, activeQuery);
    }, 12_000);
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
                <h2 className="text-xl font-semibold tracking-tight">People Intelligence</h2>
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
                className="h-10 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary"
                aria-label="Choose user management mode"
              >
                <option value="users">Users</option>
                <option value="visitors">Visitors</option>
              </select>
              <div className="flex rounded-2xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm transition-colors",
                    view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm transition-colors",
                    view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
                  className="h-10 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary"
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
        {loading && !users.length && !visitors.length ? (
          <div className={cn("grid gap-3", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
        ) : kind === "users" ? (
          <RecordsLayout view={view}>
            {users.map((user) => (
              <UserRecord key={user.id} user={user} view={view} />
            ))}
          </RecordsLayout>
        ) : (
          <RecordsLayout view={view}>
            {visitors.map((visitor) => (
              <VisitorRecord key={visitor.id} visitor={visitor} view={view} />
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

function UserRecord({ user, view }: { user: AdminUserRow; view: View }) {
  const status = userStatus(user);
  const location = userLocation(user) || "Location unknown";
  const device = [user.registrationAudit?.deviceType, user.registrationAudit?.browser, user.registrationAudit?.os]
    .filter(Boolean)
    .join(" / ");

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-background/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg",
        view === "list" && "grid gap-4 lg:grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_auto] lg:items-center"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={user.name} src={user.avatar} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.username ? `@${user.username}` : "No username"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground lg:mt-0">
        <span className="flex min-w-0 items-center gap-2">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{user.email}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{location}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">Registered {formatDate(user.registrationAudit?.registeredAt ?? user.createdAt)}</span>
        </span>
        {device ? <span className="truncate text-xs">{device}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0 lg:justify-end">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
        <ButtonLink href={`/admin/users/${user.id}`} label="See Details" />
      </div>
    </article>
  );
}

function VisitorRecord({ visitor, view }: { visitor: VisitorRow; view: View }) {
  const location = visitorLocation(visitor) || "Location unknown";
  const device = [visitor.device.deviceType, visitor.device.browser, visitor.device.os].filter(Boolean).join(" / ");

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-background/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg",
        view === "list" && "grid gap-4 lg:grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_auto] lg:items-center"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">Visitor {visitor.visitorId.slice(0, 8)}</p>
          <p className="truncate text-xs text-muted-foreground">{visitor.ipAddress ?? "IP unavailable"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground lg:mt-0">
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
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
        <ButtonLink href={`/admin/users/${encodeURIComponent(visitor.visitorId)}?kind=visitor`} label="See Details" />
      </div>
    </article>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
      <UserRound className="mx-auto mb-3 h-8 w-8 opacity-50" />
      {label}
    </div>
  );
}

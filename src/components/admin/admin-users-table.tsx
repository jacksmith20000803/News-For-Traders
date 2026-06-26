"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Laptop,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
} from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  passwordSet: boolean;
  role: Role;
  reputation: number;
  isSuspended: boolean;
  isBanned: boolean;
  createdAt: string;
  registrationAudit: {
    browser: string | null;
    deviceType: string | null;
    os: string | null;
    userAgent: string | null;
    registeredAt: string;
  } | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type UsersListData = {
  users: UserRow[];
  pagination: { page: number; totalPages: number; total?: number };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDevice(user: UserRow) {
  const audit = user.registrationAudit;
  if (!audit) return "Unknown device";
  const parts = [audit.deviceType, audit.browser, audit.os].filter(Boolean);
  return parts.length ? parts.join(" / ") : audit.userAgent ?? "Unknown device";
}

function deviceSummary(user: UserRow) {
  const audit = user.registrationAudit;
  if (!audit) return { primary: "Unknown device", secondary: "No registration audit", title: undefined };

  const primary = [audit.deviceType, audit.browser].filter(Boolean).join(" / ") || "Unknown device";
  const secondary = audit.os ?? audit.userAgent ?? "Unknown OS";
  return { primary, secondary, title: audit.userAgent ?? formatDevice(user) };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function statusFor(user: UserRow) {
  if (user.isBanned) return { label: "Banned", variant: "danger" as const };
  if (user.isSuspended) return { label: "Suspended", variant: "warning" as const };
  return { label: "Active", variant: "success" as const };
}

export function AdminUsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async (nextPage: number, q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
        ...(q ? { q } : {}),
      });
      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await readJsonResponse<ApiResponse<UsersListData>>(res);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load users");
      setUsers(json.data.users);
      setPage(json.data.pagination.page);
      setTotalPages(json.data.pagination.totalPages);
      setTotalUsers(json.data.pagination.total ?? json.data.users.length);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "hidden") return;
      void loadUsers(page, activeQuery);
    };

    const firstLoad = window.setTimeout(() => {
      run();
    }, 0);
    const poll = window.setInterval(() => {
      run();
    }, 10_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(poll);
    };
  }, [activeQuery, loadUsers, page]);

  const pageStats = useMemo(() => {
    const active = users.filter((user) => !user.isBanned && !user.isSuspended).length;
    const suspended = users.filter((user) => user.isSuspended && !user.isBanned).length;
    const banned = users.filter((user) => user.isBanned).length;
    const admins = users.filter((user) => user.role === "ADMIN").length;
    return { active, suspended, banned, admins };
  }, [users]);

  async function act(payload: Record<string, unknown>) {
    setMessage("");
    try {
      const res = await secureFetch("/api/admin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<ApiResponse<{ resetUrl?: string; message?: string }>>(res);
      if (!json.success) throw new Error(json.error ?? "Action failed");
      setMessage(json.data?.resetUrl ? `Reset URL: ${json.data.resetUrl}` : json.data?.message ?? "Done");
      await loadUsers(page, activeQuery);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    setActiveQuery(trimmed);
    setPage(1);
    if (page === 1 && activeQuery === trimmed) {
      void loadUsers(1, trimmed);
    }
  }

  function clearSearch() {
    setQuery("");
    setActiveQuery("");
    setPage(1);
    void loadUsers(1, "");
  }

  function renderIdentity(user: UserRow) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.username ? `@${user.username}` : "No username"}
          </p>
        </div>
      </div>
    );
  }

  function renderAccess(user: UserRow) {
    const status = statusFor(user);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="bg-background/70">
          {ROLE_LABELS[user.role]}
        </Badge>
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant={user.passwordSet ? "success" : "warning"}>
          {user.passwordSet ? "Password set" : "OAuth only"}
        </Badge>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          Rep {user.reputation}
        </span>
      </div>
    );
  }

  function renderActions(user: UserRow, compact = false) {
    const buttonClass = compact
      ? "h-8 px-2 text-[11px] shadow-none hover:shadow-sm"
      : "h-7 px-2 text-[11px] shadow-none hover:shadow-sm";

    return (
      <div className={cn("flex flex-wrap gap-1.5", compact ? "pt-2" : "max-w-[280px]")}>
        {!user.isSuspended && !user.isBanned && (
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => act({ action: "update_user", userId: user.id, isSuspended: true })}
          >
            <Ban className="h-3.5 w-3.5" />
            Suspend
          </Button>
        )}
        {user.isSuspended && (
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => act({ action: "update_user", userId: user.id, isSuspended: false })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reactivate
          </Button>
        )}
        {!user.isBanned ? (
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => act({ action: "update_user", userId: user.id, isBanned: true })}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Ban
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => act({ action: "update_user", userId: user.id, isBanned: false })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Unban
          </Button>
        )}
        {user.role !== "ADMIN" && (
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => act({ action: "update_user", userId: user.id, role: "MODERATOR" })}
          >
            <UserCog className="h-3.5 w-3.5" />
            Make mod
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={buttonClass}
          onClick={() => act({ action: "reset_password", userId: user.id })}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className={buttonClass}
          onClick={() => {
            if (confirm("Delete this user?")) {
              void act({ action: "delete_user", userId: user.id });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    );
  }

  const loadingEmpty = loading && users.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">All Users</h2>
                <p className="text-xs text-muted-foreground">
                  Live list refreshes every 10 seconds while this tab is active.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <span className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                <strong className="mr-1 text-foreground">{totalUsers}</strong>
                total
              </span>
              <span className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                <strong className="mr-1 text-success">{pageStats.active}</strong>
                active on page
              </span>
              <span className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                <strong className="mr-1 text-warning">{pageStats.suspended}</strong>
                suspended
              </span>
              <span className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                <strong className="mr-1 text-danger">{pageStats.banned}</strong>
                banned
              </span>
              <span className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                <strong className="mr-1 text-primary">{pageStats.admins}</strong>
                admins
              </span>
            </div>
          </div>

          <form onSubmit={submitSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative flex-1 xl:w-80 xl:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, username..."
                className="h-10 w-full rounded-xl border border-border bg-background/90 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" className="h-10 flex-1 sm:flex-none">
                Search
              </Button>
              {activeQuery && (
                <Button size="sm" type="button" variant="outline" className="h-10" onClick={clearSearch}>
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => void loadUsers(page, activeQuery)}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </form>
        </div>
      </div>

      {message && (
        <div className="mx-4 mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground break-all sm:mx-5">
          {message}
        </div>
      )}

      <div className="p-4 sm:p-5">
        {loadingEmpty ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl border border-border bg-muted/30" />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="w-[20%] px-4 py-3">User</th>
                      <th className="w-[20%] px-4 py-3">Contact</th>
                      <th className="w-[14%] px-4 py-3">Registered</th>
                      <th className="w-[18%] px-4 py-3">Device</th>
                      <th className="w-[14%] px-4 py-3">Access</th>
                      <th className="w-[14%] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const device = deviceSummary(user);
                      return (
                        <tr key={user.id} className="border-t border-border/70 align-top transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4">{renderIdentity(user)}</td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 truncate" title={user.email}>{user.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            <div className="flex gap-2">
                              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{formatDate(user.registrationAudit?.registeredAt ?? user.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            <div className="flex min-w-0 gap-2" title={device.title}>
                              <Laptop className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate">{device.primary}</p>
                                <p className="truncate text-xs">{device.secondary}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">{renderAccess(user)}</td>
                          <td className="px-4 py-4">{renderActions(user)}</td>
                        </tr>
                      );
                    })}
                    {!users.length && !loading && (
                      <tr>
                        <td className="py-10 text-center text-muted-foreground" colSpan={6}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 lg:hidden">
              {users.map((user) => {
                const device = deviceSummary(user);
                return (
                  <div key={user.id} className="rounded-xl border border-border bg-background/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      {renderIdentity(user)}
                      <Badge variant={statusFor(user).variant}>{statusFor(user).label}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs uppercase tracking-wider">Email</p>
                        <p className="truncate" title={user.email}>{user.email}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wider">Registered</p>
                        <p>{formatDate(user.registrationAudit?.registeredAt ?? user.createdAt)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs uppercase tracking-wider">Device</p>
                        <p className="truncate" title={device.title}>{device.primary}</p>
                        <p className="truncate text-xs">{device.secondary}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wider">Access</p>
                        {renderAccess(user)}
                      </div>
                    </div>
                    {renderActions(user, true)}
                  </div>
                );
              })}
              {!users.length && !loading && (
                <div className="rounded-xl border border-border bg-background/70 p-8 text-center text-sm text-muted-foreground">
                  No users found.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
          {loading && users.length > 0 ? " - refreshing..." : ""}
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

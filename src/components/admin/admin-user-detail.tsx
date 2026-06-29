"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type DetailKind = "user" | "visitor";
type ActivityView = "list" | "grid";

type AdminDetailData = {
  kind: DetailKind;
  profile: {
    id: string;
    visitorId: string | null;
    name: string;
    username: string | null;
    email: string | null;
    avatar: string | null;
    passwordStatus: string;
    role: Role | "GUEST";
    reputation?: number;
    contributionCount?: number;
    isSuspended?: boolean;
    isBanned?: boolean;
    emailVerified?: string | null;
    twoFactorEnabled?: boolean;
    createdAt: string | null;
    lastLoginAt: string | null;
  };
  details: {
    dateOfBirth: string | null;
    bio: string | null;
    interests: string[];
    feedback: Array<{
      id: string;
      type: string;
      subject: string;
      message: string;
      status: string;
      createdAt: string;
    }>;
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
      ipAddress: string | null;
    };
    sessions: Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
      expiresAt: string;
    }>;
  };
  activity: {
    selectedDate: string;
    activeDates: string[];
    items: ActivityItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

type ActivityItem = {
  id: string;
  action: string;
  path: string | null;
  target: string | null;
  ipAddress: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  createdAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function countryFlag(country: string | null | undefined) {
  if (!country || country.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...country
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0))
  );
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

export function AdminUserDetail({ id, kind }: { id: string; kind: DetailKind }) {
  const [data, setData] = useState<AdminDetailData | null>(null);
  const [date, setDate] = useState(todayKey());
  const [page, setPage] = useState(1);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityView, setActivityView] = useState<ActivityView>("list");
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("USER");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(
    async (nextPage: number, mode: "replace" | "append" = "replace") => {
      if (mode === "replace") setLoading(true);
      else setActivityLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({
          kind,
          date,
          page: String(nextPage),
          limit: "20",
        });
        const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = await readJsonResponse<ApiResponse<AdminDetailData>>(res);
        if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load detail");
        setData(json.data);
        setSelectedRole(json.data.profile.role === "GUEST" ? "USER" : json.data.profile.role);
        setPage(json.data.activity.pagination.page);
        setActivityItems((current) =>
          mode === "append" ? mergeActivity(current, json.data?.activity.items ?? []) : json.data?.activity.items ?? []
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load detail");
      } finally {
        setLoading(false);
        setActivityLoading(false);
      }
    },
    [date, id, kind]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDetail(1, "replace");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail]);

  useEffect(() => {
    if (date !== todayKey()) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden" && !activityLoading) {
        void loadDetail(1, "replace");
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [activityLoading, date, loadDetail]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !data || data.activity.pagination.page >= data.activity.pagination.totalPages) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || activityLoading) return;
      void loadDetail(page + 1, "append");
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activityLoading, data, loadDetail, page]);

  const canManageUser = data?.kind === "user";
  const location = data
    ? [
        countryFlag(data.details.location.country),
        data.details.location.country,
        data.details.location.region,
        data.details.location.city,
        data.details.location.timezone,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const device = data
    ? [data.details.device.deviceType, data.details.device.browser, data.details.device.os].filter(Boolean).join(" / ")
    : "";

  async function runAdminAction(payload: Record<string, unknown>, success = "Action completed") {
    setMessage("");
    try {
      const res = await secureFetch("/api/admin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<ApiResponse<{ message?: string; resetUrl?: string }>>(res);
      if (!json.success) throw new Error(json.error ?? "Action failed");
      setMessage(json.data?.resetUrl ? `Password reset URL: ${json.data.resetUrl}` : json.data?.message ?? success);
      await loadDetail(1, "replace");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  async function deleteLogs() {
    if (!confirm("Delete all recorded activity logs for this record?")) return;
    setMessage("");
    try {
      const res = await secureFetch(`/api/admin/users/${encodeURIComponent(id)}?kind=${kind}`, {
        method: "DELETE",
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(res);
      if (!json.success) throw new Error(json.error ?? "Failed to delete logs");
      setMessage(`Deleted ${json.data?.deleted ?? 0} activity logs.`);
      await loadDetail(1, "replace");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete logs");
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-border bg-card">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {message || "Record not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/users" className="text-sm text-primary hover:underline">
          Back to people
        </Link>
        <Button size="sm" variant="outline" onClick={() => void loadDetail(1, "replace")}>
          <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground break-all">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative min-h-56 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.32),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(5,150,105,0.55))] p-6 text-white">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:36px_36px]" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <ProfileAvatar name={data.profile.name} src={data.profile.avatar} />
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={data.kind === "user" ? "success" : "primary"}>
                      {data.kind === "user" ? "Registered user" : "Visitor"}
                    </Badge>
                    <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
                      {String(data.profile.role)}
                    </Badge>
                  </div>
                  <h1 className="truncate text-3xl font-semibold tracking-tight">{data.profile.name}</h1>
                  <p className="truncate text-sm text-white/78">
                    {data.profile.username ? `@${data.profile.username}` : data.profile.visitorId ?? "No username"}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 text-sm text-white/82">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {data.profile.email ?? "No email"}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {location || "Location unknown"}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Joined {formatDateTime(data.profile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <InfoCard title="Password">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {showPassword
                    ? data.profile.passwordStatus
                    : "Hidden by security policy. Admins can issue a reset instead."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:text-primary"
                  aria-label={showPassword ? "Hide password status" : "Show password status"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </InfoCard>
            <InfoCard title="Registration">
              <p>{formatDateTime(data.profile.createdAt)}</p>
              <p className="text-xs text-muted-foreground">
                Last login: {formatDateTime(data.profile.lastLoginAt, data.details.location.timezone)}
              </p>
            </InfoCard>
            <InfoCard title="Device">
              <p>{device || "Unknown device"}</p>
              <p className="truncate text-xs text-muted-foreground">{data.details.device.userAgent ?? "No user agent"}</p>
            </InfoCard>
            <InfoCard title="Network">
              <p>{data.details.device.ipAddress ?? "IP unavailable"}</p>
              <p className="text-xs text-muted-foreground">{data.details.location.timezone ?? "Timezone unavailable"}</p>
            </InfoCard>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Detailed Information</h2>
            <div className="grid gap-3 text-sm">
              <DetailLine label="Date of birth" value={data.details.dateOfBirth ? formatDateTime(data.details.dateOfBirth) : "Not provided"} />
              <DetailLine label="Bio" value={data.details.bio ?? "No bio provided"} />
              <DetailLine label="Interests" value={data.details.interests.length ? data.details.interests.join(", ") : "No interests"} />
              <DetailLine label="Email verified" value={data.profile.emailVerified ? formatDateTime(data.profile.emailVerified) : "Not verified"} />
              <DetailLine label="Two-factor" value={data.profile.twoFactorEnabled ? "Enabled" : "Disabled"} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Feedback</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {data.details.feedback.length ? (
                data.details.feedback.map((feedback) => (
                  <div key={feedback.id} className="rounded-2xl border border-border bg-background/70 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-medium">{feedback.subject}</p>
                      <Badge variant="outline">{feedback.status}</Badge>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{feedback.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No feedback submitted.</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      {canManageUser ? (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Account Controls</h2>
              <p className="text-sm text-muted-foreground">Manage access, roles, sessions, and password recovery.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as Role)}
                className="h-10 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="USER">Common user</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>
              <Button size="sm" className="h-10" onClick={() => runAdminAction({ action: "update_user", userId: id, role: selectedRole }, "Role updated")}>
                <ShieldCheck className="h-4 w-4" />
                Save role
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => runAdminAction({ action: "reset_password", userId: id })}>
              <KeyRound className="h-4 w-4" />
              Reset password
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                runAdminAction({
                  action: "update_user",
                  userId: id,
                  isSuspended: !data.profile.isSuspended,
                })
              }
            >
              <Ban className="h-4 w-4" />
              {data.profile.isSuspended ? "Remove suspension" : "Disable account"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Delete this account?")) void runAdminAction({ action: "delete_user", userId: id }, "User deleted");
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
            <h3 className="mb-3 text-sm font-semibold">Connected Sessions</h3>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {data.details.sessions.length ? (
                data.details.sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-border bg-card/70 px-3 py-2 text-xs">
                    <p className="font-medium">{formatDateTime(session.createdAt, data.details.location.timezone)}</p>
                    <p className="truncate text-muted-foreground">{session.ipAddress ?? "No IP"} - {session.userAgent ?? "No user agent"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active sessions recorded.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">User Activity</h2>
            <p className="text-sm text-muted-foreground">
              Select a date to inspect page visits and button clicks in chronological order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={deleteLogs}>
              <Trash2 className="h-4 w-4" />
              Delete logs
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportActivity(activityItems)}>
              <Download className="h-4 w-4" />
              Export visible
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <ActivityDatePicker
            selectedDate={date}
            activeDates={data.activity.activeDates}
            onSelect={(nextDate) => {
              setDate(nextDate);
              setPage(1);
              setActivityItems([]);
            }}
          />

          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.activity.pagination.total} events on {date}
              </p>
              <div className="flex rounded-2xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setActivityView("list")}
                  className={cn(
                    "rounded-xl px-3 py-2 transition-colors",
                    activityView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Activity list view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivityView("grid")}
                  className={cn(
                    "rounded-xl px-3 py-2 transition-colors",
                    activityView === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Activity card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={cn("grid gap-3", activityView === "grid" && "md:grid-cols-2")}>
              {activityItems.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} view={activityView} />
              ))}
            </div>
            {!activityItems.length && !activityLoading ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                No activity recorded for this date.
              </div>
            ) : null}
            <div ref={sentinelRef} className="h-8" />
            {activityLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function mergeActivity(current: ActivityItem[], next: ActivityItem[]) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

function ProfileAvatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className="h-24 w-24 shrink-0 rounded-3xl object-cover ring-2 ring-white/30" />
    );
  }
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white/14 text-2xl font-semibold ring-2 ring-white/25">
      {initials(name)}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-border bg-background/70 p-3 sm:grid-cols-[130px_minmax(0,1fr)]">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

function ActivityDatePicker({
  selectedDate,
  activeDates,
  onSelect,
}: {
  selectedDate: string;
  activeDates: string[];
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => selectedDate.slice(0, 7));
  const activeSet = useMemo(() => new Set(activeDates), [activeDates]);
  const days = useMemo(() => buildMonthDays(month), [month]);

  return (
    <div className="rounded-3xl border border-border bg-background/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="rounded-xl border border-border p-2 text-muted-foreground hover:text-primary"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-center text-sm font-medium outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="rounded-xl border border-border p-2 text-muted-foreground hover:text-primary"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const hasActivity = activeSet.has(day);
          const selected = day === selectedDate;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "aspect-square rounded-full text-xs font-medium transition-all",
                hasActivity ? "bg-emerald-500/18 text-emerald-600 dark:text-emerald-300" : "bg-red-500/10 text-red-500",
                selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                "hover:scale-105 hover:bg-primary hover:text-primary-foreground"
              )}
              title={hasActivity ? "Activity recorded" : "No activity recorded"}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> activity</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> no activity</span>
      </div>
    </div>
  );
}

function buildMonthDays(month: string) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const first = new Date(Date.UTC(yearValue, monthValue - 1, 1));
  const totalDays = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const days: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= totalDays; day += 1) {
    days.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

function shiftMonth(month: string, offset: number) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const date = new Date(Date.UTC(yearValue, monthValue - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ActivityRow({ activity, view }: { activity: ActivityItem; view: ActivityView }) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-background/70 p-4 text-sm shadow-sm",
        view === "list" && "grid gap-3 lg:grid-cols-[170px_1fr_240px]"
      )}
    >
      <div>
        <p className="font-semibold text-foreground">{activity.action.replace(/_/g, " ")}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-foreground">{activity.target ?? activity.path ?? "No target"}</p>
        <p className="truncate text-xs text-muted-foreground">{activity.path ?? "Path unavailable"}</p>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {[activity.deviceType, activity.browser, activity.os, activity.ipAddress].filter(Boolean).join(" / ") || "No device data"}
      </p>
    </article>
  );
}

function exportActivity(items: ActivityItem[]) {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tradx-user-activity.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

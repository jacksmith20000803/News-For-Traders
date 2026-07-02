"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  Upload,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfToken, readJsonResponse, secureFetch } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

interface ProfileEditorUser {
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  location: string | null;
}

const avatarLibrary = [
  { label: "Bitcoin", src: "/coin-avatar/btc.webp" },
  { label: "DOGE", src: "/coin-avatar/doge.webp" },
  { label: "UNI", src: "/coin-avatar/uni.webp" },
  { label: "Ethereum", src: "/coin-avatar/eth.webp" },
  { label: "Solana", src: "/coin-avatar/sol.webp" },
  { label: "XRP", src: "/coin-avatar/xrp.webp" },
  { label: "Litecoin", src: "/coin-avatar/ltc.webp" },
  { label: "BNB", src: "/coin-avatar/bnb.webp" },
  { label: "Polkadot", src: "/coin-avatar/dot.webp" },
  { label: "Chainlink", src: "/coin-avatar/link.webp" },
  { label: "ETC", src: "/coin-avatar/etc.webp" },
  { label: "ADA", src: "/coin-avatar/ada.webp" },
  { label: "AVAX", src: "/coin-avatar/avax.webp" },
  { label: "EUR", src: "/coin-avatar/eur.webp" },
];

const locations = [
  "New York, United States",
  "San Francisco, United States",
  "Los Angeles, United States",
  "Chicago, United States",
  "Miami, United States",
  "London, United Kingdom",
  "Toronto, Canada",
  "Vancouver, Canada",
  "Berlin, Germany",
  "Paris, France",
  "Zurich, Switzerland",
  "Singapore",
  "Hong Kong",
  "Tokyo, Japan",
  "Seoul, South Korea",
  "Sydney, Australia",
  "Dubai, United Arab Emirates",
  "Amsterdam, Netherlands",
];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const dateControlClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 shadow-sm outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#071012] dark:text-white dark:shadow-black/20 dark:[color-scheme:dark]";

const dateOptionClass = "bg-white text-gray-900 dark:bg-[#071012] dark:text-white";

export function ProfileEditor({ user }: { user: ProfileEditorUser }) {
  const router = useRouter();
  const { refresh, updateAuthenticatedUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const initialDate = user.dateOfBirth ? new Date(user.dateOfBirth) : new Date(1995, 0, 1);
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [calendarYearDraft, setCalendarYearDraft] = useState(String(initialDate.getFullYear()));
  const [dateOpen, setDateOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    username: user.username ?? "",
    avatar: user.avatar ?? "",
    bio: user.bio ?? "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    location: user.location ?? "",
    currentPassword: "",
    newPassword: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const locationMatches = useMemo(() => {
    const query = form.location.trim().toLowerCase();
    if (!query) return locations.slice(0, 6);
    return locations
      .filter((location) => location.toLowerCase().includes(query))
      .slice(0, 6);
  }, [form.location]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  const selectedDateParts = useMemo(
    () => parseDateInputValue(form.dateOfBirth),
    [form.dateOfBirth]
  );

  const daysInVisibleMonth = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    return Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, index) => index + 1
    );
  }, [calendarMonth]);

  useEffect(() => {
    if (!dateOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && datePickerRef.current?.contains(target)) return;
      setDateOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [dateOpen]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setVisibleMonth = (date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), 1);
    setCalendarMonth(normalized);
    setCalendarYearDraft(String(normalized.getFullYear()));
  };

  const openDatePicker = () => {
    const selected = parseDateInputValue(form.dateOfBirth);
    if (selected) {
      setVisibleMonth(new Date(selected.year, selected.month - 1, 1));
    }
    setDateOpen((open) => !open);
  };

  const updateCalendarYear = (value: string) => {
    setCalendarYearDraft(value);

    const year = Number(value);
    if (!Number.isInteger(year) || year < 1 || year > 9999) return;
    setCalendarMonth((date) => new Date(year, date.getMonth(), 1));
  };

  const commitCalendarYear = () => {
    const year = Number(calendarYearDraft);
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      setCalendarYearDraft(String(calendarMonth.getFullYear()));
    }
  };

  const selectDate = (day: number) => {
    const selected = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    update("dateOfBirth", toDateInputValue(selected));
    setDateOpen(false);
  };

  const handleDatePickerBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setDateOpen(false);
      commitCalendarYear();
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setStatus("");
    setError("");

    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/user/avatar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": await getCsrfToken() },
        body,
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { avatar?: string };
      }>(response);

      if (!json.success || !json.data?.avatar) {
        setError(json.error ?? "Could not upload avatar");
        return;
      }

      update("avatar", json.data.avatar);
      updateAuthenticatedUser({ avatar: json.data.avatar });
      setStatus("Avatar uploaded. Save changes to keep the rest of your profile updates.");
      await refresh();
      router.refresh();
    } catch {
      setError("Could not upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    try {
      const payload: Record<string, string> = {
        name: form.name,
        username: form.username,
        avatar: form.avatar,
        bio: form.bio,
        dateOfBirth: form.dateOfBirth,
        location: form.location,
      };

      if (form.newPassword.trim()) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const response = await secureFetch("/api/user", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: {
          name?: string;
          username?: string | null;
          avatar?: string | null;
          bio?: string | null;
          dateOfBirth?: string | null;
          location?: string | null;
        };
      }>(response);

      if (!json.success) {
        setError(json.error ?? "Could not save profile");
        return;
      }

      setForm((current) => ({
        ...current,
        name: json.data?.name ?? current.name,
        username: json.data?.username ?? current.username,
        avatar: json.data?.avatar ?? current.avatar,
        bio: json.data?.bio ?? current.bio,
        dateOfBirth: json.data?.dateOfBirth
          ? String(json.data.dateOfBirth).slice(0, 10)
          : current.dateOfBirth,
        location: json.data?.location ?? current.location,
        currentPassword: "",
        newPassword: "",
      }));
      updateAuthenticatedUser({
        name: json.data?.name ?? form.name,
        username: json.data?.username ?? (form.username || null),
        avatar: json.data?.avatar ?? (form.avatar || null),
        bio: json.data?.bio ?? form.bio,
      });
      setStatus("Profile updated");
      await refresh();
      router.refresh();
    } catch {
      setError("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/10 dark:bg-[#101214]/95 lg:col-span-2">
      <CardHeader className="border-b border-border/70 bg-white/95 p-6 pb-5 dark:bg-[#101214]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserRound className="h-5 w-5 text-primary" />
              Profile Settings
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Update your public trader identity and account preferences.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white p-2 pr-4 shadow-sm dark:bg-[#0b0d0f]">
            <AvatarPreview avatar={form.avatar} name={form.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{form.name || "Trader"}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">@{form.username || "username"}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-6 sm:p-6 sm:pt-7">
        <form onSubmit={save} className="space-y-6">
          <section className="grid gap-6 rounded-2xl border border-border/70 bg-white/95 p-5 dark:bg-[#0b0d0f] lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#101214]">
              <AvatarPreview avatar={form.avatar} name={form.name} size="lg" />
              <div>
                <p className="text-sm font-semibold">Avatar</p>
                <p className="text-xs text-muted-foreground">Upload an image or choose a site icon.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => void uploadAvatar(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="h-4 w-4 text-primary" />
                Site Image Library
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {avatarLibrary.map((avatar) => (
                  <button
                    key={`${avatar.label}-${avatar.src}`}
                    type="button"
                    onClick={() => update("avatar", avatar.src)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-2xl border bg-card p-2 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg",
                      form.avatar === avatar.src ? "border-primary ring-2 ring-primary/30" : "border-border"
                    )}
                    aria-label={`Use ${avatar.label} avatar`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar.src} alt="" className="h-full w-full object-contain" />
                    {form.avatar === avatar.src && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Display name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="John Smith"
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(event) => update("username", event.target.value)}
              placeholder="username"
            />
            <Input label="Email" value={form.email} disabled readOnly className="opacity-75" />
            <div ref={datePickerRef} className="relative" onBlur={handleDatePickerBlur}>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Date of Birth
              </label>
              <button
                type="button"
                onClick={openDatePicker}
                className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={form.dateOfBirth ? "text-foreground" : "text-muted-foreground"}>
                  {form.dateOfBirth ? formatDisplayDate(form.dateOfBirth) : "Select date"}
                </span>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </button>
              {dateOpen && (
                <div className="profile-date-picker absolute left-0 top-full z-40 mt-2 w-[21rem] rounded-3xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl shadow-black/15 dark:border-white/10 dark:bg-[#071012] dark:text-white dark:shadow-black/40">
                  <div className="mb-3 grid grid-cols-[1fr_1.2fr_1fr] gap-2">
                    <label className="sr-only" htmlFor="dob-year">
                      Year
                    </label>
                    <input
                      id="dob-year"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={9999}
                      value={calendarYearDraft}
                      onChange={(event) => updateCalendarYear(event.target.value)}
                      onBlur={commitCalendarYear}
                      className={dateControlClass}
                      aria-label="Year"
                    />
                    <label className="sr-only" htmlFor="dob-month">
                      Month
                    </label>
                    <div className="relative">
                      <select
                        id="dob-month"
                        value={calendarMonth.getMonth()}
                        onChange={(event) =>
                          setVisibleMonth(
                            new Date(calendarMonth.getFullYear(), Number(event.target.value), 1)
                          )
                        }
                        className={cn(dateControlClass, "appearance-none pr-8")}
                        aria-label="Month"
                      >
                        {monthNames.map((month, index) => (
                          <option key={month} value={index} className={dateOptionClass}>
                            {month.slice(0, 3)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <label className="sr-only" htmlFor="dob-day">
                      Day
                    </label>
                    <div className="relative">
                      <select
                        id="dob-day"
                        value={
                          selectedDateParts &&
                          selectedDateParts.year === calendarMonth.getFullYear() &&
                          selectedDateParts.month === calendarMonth.getMonth() + 1
                            ? selectedDateParts.day
                            : ""
                        }
                        onChange={(event) => {
                          const day = Number(event.target.value);
                          if (day) selectDate(day);
                        }}
                        className={cn(dateControlClass, "appearance-none pr-8")}
                        aria-label="Day"
                      >
                        <option value="" className={dateOptionClass}>Day</option>
                        {daysInVisibleMonth.map((day) => (
                          <option key={day} value={day} className={dateOptionClass}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-gray-100 px-2 py-1.5 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth(
                          new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                        )
                      }
                      className="rounded-xl p-2 text-muted-foreground transition hover:bg-white hover:text-foreground dark:hover:bg-white/10"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <p className="text-sm font-semibold">
                      {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth(
                          new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                        )
                      }
                      className="rounded-xl p-2 text-muted-foreground transition hover:bg-white hover:text-foreground dark:hover:bg-white/10"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                      <span key={`${day}-${index}`}>{day}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) =>
                      day ? (
                        <button
                          key={day}
                          type="button"
                          onClick={() => selectDate(day)}
                          className={cn(
                            "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition hover:bg-blue-500/10 hover:text-blue-500",
                            form.dateOfBirth === toDateInputValue(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) &&
                              "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:text-white"
                          )}
                        >
                          {day}
                        </button>
                      ) : (
                        <span key={`blank-${index}`} />
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <UserRound className="h-4 w-4" />
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
              placeholder="Tell the community about your market style, focus, and experience."
              className="min-h-[112px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-sm font-medium text-foreground">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={form.location}
                onChange={(event) => {
                  update("location", event.target.value);
                  setLocationOpen(true);
                }}
                onFocus={() => setLocationOpen(true)}
                onBlur={() => window.setTimeout(() => setLocationOpen(false), 140)}
                placeholder="Search city or country"
                className="flex h-10 w-full rounded-lg border border-border bg-card px-9 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {locationOpen && locationMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl dark:bg-[#101214]">
                {locationMatches.map((location) => (
                  <button
                    key={location}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      update("location", location);
                      setLocationOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 focus-visible:bg-emerald-500/10 focus-visible:text-emerald-600 focus-visible:outline-none dark:hover:bg-emerald-400/12 dark:hover:text-emerald-200"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {location}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <Globe className="h-4 w-4" />
                Email is protected
              </div>
              Email address changes are disabled for account safety.
            </div>
            <div className="rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <Camera className="h-4 w-4" />
                Image guidance
              </div>
              Use a square image under 2MB for the sharpest avatar.
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary" />
              Change password
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Current password"
                type="password"
                value={form.currentPassword}
                onChange={(event) => update("currentPassword", event.target.value)}
              />
              <Input
                label="New password"
                type="password"
                value={form.newPassword}
                onChange={(event) => update("newPassword", event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="text-sm text-emerald-500">
              {status}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="destructive"
              onClick={() => router.refresh()}
              className="bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={saving}
              className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AvatarPreview({
  avatar,
  name,
  size,
}: {
  avatar: string;
  name: string;
  size: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-28 w-28 text-4xl" : "h-11 w-11 text-base";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-cyan-400 font-bold text-primary-foreground shadow-lg shadow-primary/20",
        sizeClass
      )}
      style={
        avatar
          ? {
              backgroundImage: `url(${avatar})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!avatar && (name.trim().charAt(0).toUpperCase() || "U")}
    </span>
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  return { year, month, day };
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

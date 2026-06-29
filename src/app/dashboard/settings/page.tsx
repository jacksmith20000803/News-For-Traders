"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SelectHTMLAttributes,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import type { InterestCategory, PreferredMarket } from "@prisma/client";
import {
  Activity,
  Bell,
  ChevronDown,
  CheckCircle2,
  Database,
  Github,
  Globe2,
  Hash,
  Loader2,
  MessageCircle,
  MonitorUp,
  PlugZap,
  Radio,
  RefreshCcw,
  Save,
  Settings2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  Wifi,
  Youtube,
} from "lucide-react";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Button } from "@/components/ui/button";
import { INTEREST_LABELS } from "@/lib/constants";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useConnectionStatus } from "@/components/realtime/sse-provider";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";
type SettingsSection = "profile" | "notifications" | "connections";
type LiveStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

interface ProfileSnapshot {
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  location: string | null;
  reputation: number;
  contributionCount: number;
  createdAt: string | null;
}

interface NotificationSettingsForm {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  adminMessages: boolean;
  profileChanges: boolean;
  systemAnnounce: boolean;
  marketingEmails: boolean;
}

interface ConnectionForm {
  preferredMarket: PreferredMarket;
  theme: ThemeMode;
  chartInterval: string;
  defaultSymbol: string;
}

interface DeviceSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

interface TrustedDevice {
  id: string;
  deviceName: string | null;
  createdAt: string;
  expiresAt: string;
}

interface DeviceState {
  sessions: DeviceSession[];
  trustedDevices: TrustedDevice[];
}

const defaultProfile: ProfileSnapshot = {
  name: "",
  email: "",
  username: null,
  avatar: null,
  bio: null,
  dateOfBirth: null,
  location: null,
  reputation: 0,
  contributionCount: 0,
  createdAt: null,
};

const defaultNotifications: NotificationSettingsForm = {
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  priceAlerts: true,
  newsAlerts: true,
  adminMessages: true,
  profileChanges: true,
  systemAnnounce: true,
  marketingEmails: false,
};

const defaultConnection: ConnectionForm = {
  preferredMarket: "CRYPTO",
  theme: "dark",
  chartInterval: "100ms",
  defaultSymbol: "BTC/USD",
};

const markets: Array<{ value: PreferredMarket; label: string }> = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "FOREX", label: "Forex" },
  { value: "STOCKS", label: "Stocks" },
  { value: "COMMODITIES", label: "Commodities" },
];

const externalPlatforms: Array<{
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  authProvider: string;
  supported: boolean;
}> = [
  {
    id: "github",
    label: "GitHub",
    description: "Sync research notebooks and strategy repositories.",
    icon: Github,
    tone: "from-slate-500 to-zinc-900",
    authProvider: "github",
    supported: true,
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Connect social identity and community updates.",
    icon: Globe2,
    tone: "from-blue-500 to-sky-700",
    authProvider: "facebook",
    supported: false,
  },
  {
    id: "x",
    label: "X",
    description: "Track market conversations and creator updates.",
    icon: Hash,
    tone: "from-gray-700 to-black",
    authProvider: "x",
    supported: false,
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Link video research channels and saved analysis.",
    icon: Youtube,
    tone: "from-red-500 to-rose-700",
    authProvider: "youtube",
    supported: false,
  },
  {
    id: "reddit",
    label: "Reddit",
    description: "Follow communities and long-form market discussions.",
    icon: Radio,
    tone: "from-orange-500 to-amber-700",
    authProvider: "reddit",
    supported: false,
  },
  {
    id: "discord",
    label: "Discord",
    description: "Connect trading groups and signal rooms.",
    icon: MessageCircle,
    tone: "from-indigo-500 to-violet-700",
    authProvider: "discord",
    supported: false,
  },
];

export default function UserSettingsPage() {
  const searchParams = useSearchParams();
  const { user, setAuthenticatedUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { status: connectionStatus } = useConnectionStatus();
  const [profile, setProfile] = useState<ProfileSnapshot>(defaultProfile);
  const [notifications, setNotifications] = useState<NotificationSettingsForm>(defaultNotifications);
  const [connection, setConnection] = useState<ConnectionForm>({ ...defaultConnection, theme });
  const [selectedInterests, setSelectedInterests] = useState<InterestCategory[]>([]);
  const [devices, setDevices] = useState<DeviceState>({ sessions: [], trustedDevices: [] });
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [verifiedPlatforms, setVerifiedPlatforms] = useState<string[]>([]);
  const [authenticatingPlatform, setAuthenticatingPlatform] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const activeSection = normalizeSection(searchParams.get("section"));

  const completionScore = useMemo(() => {
    const checks = [
      Boolean(profile.name.trim()),
      Boolean(profile.username?.trim()),
      Boolean(profile.bio?.trim()),
      Boolean(profile.location?.trim()),
      selectedInterests.length > 0,
      notifications.inAppEnabled,
      Boolean(connection.defaultSymbol.trim()),
      verifiedPlatforms.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [connection.defaultSymbol, notifications.inAppEnabled, profile, selectedInterests.length, verifiedPlatforms.length]);

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const response = await fetch("/api/user/devices", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<{
        success: boolean;
        data?: DeviceState;
      }>(response);

      if (response.ok && json.success && json.data) {
        setDevices(json.data);
      }
    } catch {
      setDevices({ sessions: [], trustedDevices: [] });
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const loadPlatformConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/user/connections", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<{
        success: boolean;
        data?: { providers?: string[] };
      }>(response);

      if (response.ok && json.success) {
        setVerifiedPlatforms(json.data?.providers ?? []);
      }
    } catch {
      setVerifiedPlatforms([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setError("");
      try {
        const [preferencesResponse, userResponse] = await Promise.all([
          fetch("/api/preferences", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/user", { cache: "no-store", credentials: "same-origin" }),
        ]);

        const preferencesJson = await readJsonResponse<{
          success: boolean;
          error?: string;
          data?: {
            profile?: {
              name?: string;
              username?: string | null;
              email?: string;
              avatar?: string | null;
              bio?: string | null;
              country?: string | null;
              dateOfBirth?: string | null;
            } | null;
            preferences?: {
              preferredMarket?: PreferredMarket;
              theme?: string;
              chartInterval?: string;
              defaultSymbol?: string | null;
            } | null;
            notificationSettings?: Partial<NotificationSettingsForm> | null;
          };
        }>(preferencesResponse);
        const userJson = await readJsonResponse<{
          success: boolean;
          error?: string;
          data?: {
            profile?: {
              name?: string;
              email?: string;
              username?: string | null;
              avatar?: string | null;
              bio?: string | null;
              dateOfBirth?: string | null;
              country?: string | null;
              reputation?: number;
              contributionCount?: number;
              createdAt?: string;
            } | null;
            interests?: Array<{ category: InterestCategory }>;
          };
        }>(userResponse);

        if (!preferencesResponse.ok || !preferencesJson.success) {
          throw new Error(preferencesJson.error ?? "Could not load user settings");
        }
        if (!userResponse.ok || !userJson.success) {
          throw new Error(userJson.error ?? "Could not load interests");
        }
        if (cancelled) return;

        const remoteProfile = preferencesJson.data?.profile;
        const detailedProfile = userJson.data?.profile;
        const remotePreferences = preferencesJson.data?.preferences;

        setProfile({
          name: remoteProfile?.name ?? detailedProfile?.name ?? user?.name ?? "",
          email: remoteProfile?.email ?? detailedProfile?.email ?? user?.email ?? "",
          username: remoteProfile?.username ?? detailedProfile?.username ?? user?.username ?? null,
          avatar: remoteProfile?.avatar ?? detailedProfile?.avatar ?? user?.avatar ?? null,
          bio: remoteProfile?.bio ?? detailedProfile?.bio ?? user?.bio ?? null,
          dateOfBirth: normalizeDate(remoteProfile?.dateOfBirth ?? detailedProfile?.dateOfBirth),
          location: remoteProfile?.country ?? detailedProfile?.country ?? null,
          reputation: detailedProfile?.reputation ?? user?.reputation ?? 0,
          contributionCount: detailedProfile?.contributionCount ?? user?.contributionCount ?? 0,
          createdAt: normalizeDate(detailedProfile?.createdAt ?? user?.createdAt),
        });
        setNotifications({ ...defaultNotifications, ...(preferencesJson.data?.notificationSettings ?? {}) });
        setConnection({
          preferredMarket: remotePreferences?.preferredMarket ?? defaultConnection.preferredMarket,
          theme: isThemeMode(remotePreferences?.theme) ? remotePreferences.theme : theme,
          chartInterval: "100ms",
          defaultSymbol: remotePreferences?.defaultSymbol ?? defaultConnection.defaultSymbol,
        });
        setSelectedInterests(userJson.data?.interests?.map((interest) => interest.category) ?? []);
        void loadDevices();
        void loadPlatformConnections();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load user settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [
    loadDevices,
    loadPlatformConnections,
    theme,
    user?.avatar,
    user?.bio,
    user?.contributionCount,
    user?.createdAt,
    user?.email,
    user?.name,
    user?.reputation,
    user?.username,
  ]);

  const saveNotifications = async () => {
    await saveSection("notifications", async () => {
      const response = await secureFetch("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ section: "notifications", ...notifications }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not save notification settings");
      }
    }, "Notification preferences saved.");
  };

  const saveConnection = async () => {
    await saveSection("connection", async () => {
      const response = await secureFetch("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ section: "connection", ...connection, chartInterval: "100ms" }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not save connection settings");
      }
      setTheme(connection.theme);
    }, "Connection preferences saved.");
  };

  const saveInterests = async () => {
    await saveSection("interests", async () => {
      const response = await secureFetch("/api/user", {
        method: "PUT",
        body: JSON.stringify({ categories: selectedInterests }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not save interests");
      }
    }, "Market interests saved.");
  };

  async function saveSection(section: string, action: () => Promise<void>, message: string) {
    setSavingSection(section);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save settings");
    } finally {
      setSavingSection("");
    }
  }

  const toggleInterest = (category: InterestCategory) => {
    setSelectedInterests((current) => {
      if (current.includes(category)) return current.filter((item) => item !== category);
      if (current.length >= 6) {
        setError("Select up to 6 market interests.");
        return current;
      }
      setError("");
      return [...current, category];
    });
  };

  const startPlatformAuthentication = (platformId: string) => {
    const platform = externalPlatforms.find((item) => item.id === platformId);
    if (!platform) return;

    if (!platform.supported) {
      setSuccess("");
      setError(`${platform.label} authentication is not configured for this deployment yet.`);
      return;
    }

    setAuthenticatingPlatform(platformId);
    const returnTo = encodeURIComponent("/dashboard/settings?section=connections");
    window.location.href = `/api/auth/oauth/${platform.authProvider}?returnTo=${returnTo}`;
  };

  const revokeDevice = async (type: "session" | "trustedDevice", id: string) => {
    await saveSection(`device-${id}`, async () => {
      const response = await secureFetch("/api/user/devices", {
        method: "DELETE",
        body: JSON.stringify({ type, id }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not revoke device access");
      }
      await loadDevices();
    }, "Device access updated.");
  };

  const disableAccount = async () => {
    if (!window.confirm("Disable this account and end all sessions?")) return;

    await saveSection("disable-account", async () => {
      const response = await secureFetch("/api/user/account", {
        method: "PATCH",
        body: JSON.stringify({ action: "disable" }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not disable account");
      }
      setAuthenticatedUser(null);
      window.location.href = "/";
    }, "Account disabled.");
  };

  const deleteAccount = async () => {
    if (!window.confirm("Permanently delete this account? This cannot be undone.")) return;

    await saveSection("delete-account", async () => {
      const response = await secureFetch("/api/user", { method: "DELETE" });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(response);
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Could not delete account");
      }
      setAuthenticatedUser(null);
      window.location.href = "/";
    }, "Account deleted.");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="mb-6 overflow-hidden rounded-[2rem] border border-border/80 bg-card/95 shadow-2xl shadow-black/10">
        <div className="relative min-h-[220px] p-6 sm:p-8">
          <div
            className="absolute inset-0 opacity-20 dark:opacity-25"
            style={{
              backgroundImage: "linear-gradient(120deg, rgba(5, 150, 105, 0.72), rgba(15, 23, 42, 0.9)), url('/default-news.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.22),transparent_26rem)]" />
          <div className="relative flex min-h-[164px] flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
                <Settings2 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-500">TradX Control Center</p>
                <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">User Settings</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Choose a settings area from the sidebar, then manage profile identity, alerts, sessions, and connected platforms in a focused panel.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <Metric label="Setup" value={`${completionScore}%`} />
              <Metric label="Live Data" value={connectionStatusLabel(connectionStatus)} tone={connectionStatus} />
              <Metric label="Default" value={connection.defaultSymbol || "BTC/USD"} />
            </div>
          </div>
        </div>
      </section>

      {(success || error) && (
        <div
          className={cn(
            "mb-6 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
            success
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {success ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {success || error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-border bg-card/95 p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading user settings...</p>
        </div>
      ) : (
        <main>
          {activeSection === "profile" && (
            <AccountProfileSection
              profile={profile}
              selectedInterests={selectedInterests}
              devices={devices}
              devicesLoading={devicesLoading}
              savingSection={savingSection}
              onRefreshDevices={loadDevices}
              onRevokeDevice={revokeDevice}
              onToggleInterest={toggleInterest}
              onSaveInterests={saveInterests}
              onDisableAccount={disableAccount}
              onDeleteAccount={deleteAccount}
            />
          )}

          {activeSection === "notifications" && (
            <NotificationsSection
              notifications={notifications}
              savingSection={savingSection}
              onChange={(key, checked) =>
                setNotifications((current) => ({ ...current, [key]: checked }))
              }
              onSave={saveNotifications}
            />
          )}

          {activeSection === "connections" && (
            <ConnectionsSection
              connection={connection}
              connectionStatus={connectionStatus}
              verifiedPlatforms={verifiedPlatforms}
              authenticatingPlatform={authenticatingPlatform}
              savingSection={savingSection}
              onConnectionChange={setConnection}
              onAuthenticatePlatform={startPlatformAuthentication}
              onSave={saveConnection}
            />
          )}
        </main>
      )}
    </div>
  );
}

function AccountProfileSection({
  profile,
  selectedInterests,
  devices,
  devicesLoading,
  savingSection,
  onRefreshDevices,
  onRevokeDevice,
  onToggleInterest,
  onSaveInterests,
  onDisableAccount,
  onDeleteAccount,
}: {
  profile: ProfileSnapshot;
  selectedInterests: InterestCategory[];
  devices: DeviceState;
  devicesLoading: boolean;
  savingSection: string;
  onRefreshDevices: () => Promise<void>;
  onRevokeDevice: (type: "session" | "trustedDevice", id: string) => Promise<void>;
  onToggleInterest: (category: InterestCategory) => void;
  onSaveInterests: () => Promise<void>;
  onDisableAccount: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <TraderSnapshot profile={profile} />
        <ProfileEditor
          user={{
            name: profile.name,
            email: profile.email,
            username: profile.username,
            avatar: profile.avatar,
            bio: profile.bio,
            dateOfBirth: profile.dateOfBirth,
            location: profile.location,
          }}
        />
      </div>

      <Panel
        icon={Sparkles}
        title="Market Interests"
        description="Select up to 6 interests to personalize news, alerts, and AI context."
        action={
          <Button
            type="button"
            onClick={onSaveInterests}
            isLoading={savingSection === "interests"}
            className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
          >
            <Save className="h-4 w-4" />
            Save Interests
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {(Object.entries(INTEREST_LABELS) as Array<[InterestCategory, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onToggleInterest(key)}
              className={cn(
                "rounded-2xl border px-4 py-2.5 text-sm font-extrabold transition-all hover:-translate-y-0.5 active:scale-95",
                selectedInterests.includes(key)
                  ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-700 shadow-lg shadow-emerald-500/10 dark:text-emerald-200"
                  : "border-border bg-background/70 hover:border-blue-400/45 hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{selectedInterests.length}/6 selected</p>
      </Panel>

      <SessionAndAccountPanel
        devices={devices}
        devicesLoading={devicesLoading}
        savingSection={savingSection}
        onRefreshDevices={onRefreshDevices}
        onRevokeDevice={onRevokeDevice}
        onDisableAccount={onDisableAccount}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}

function TraderSnapshot({ profile }: { profile: ProfileSnapshot }) {
  const identitySignals = [
    { label: "Name", done: Boolean(profile.name.trim()) },
    { label: "Avatar", done: Boolean(profile.avatar) },
    { label: "Bio", done: Boolean(profile.bio?.trim()) },
    { label: "Location", done: Boolean(profile.location?.trim()) },
  ];
  const profileCompletion = Math.round(
    (identitySignals.filter((signal) => signal.done).length / identitySignals.length) * 100
  );

  return (
    <section className="h-full overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl shadow-black/10">
      <div className="relative h-full p-5">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "linear-gradient(160deg, rgba(16,185,129,0.58), rgba(2,6,23,0.88)), url('/default-news.jpg')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="relative flex h-full flex-col gap-4">
          <div className="flex items-center gap-3">
            <AvatarBlock avatar={profile.avatar} name={profile.name} />
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{profile.name || "Trader"}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">@{profile.username || "username"}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm backdrop-blur">
            <p className="text-sm font-black">Trader Snapshot</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {profile.bio || "No bio yet. Add a short trading profile so other traders know your market focus."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Reputation" value={String(profile.reputation)} />
            <Metric label="Posts" value={String(profile.contributionCount)} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Account Profile
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Location: {profile.location || "No location"}.
              Joined: {formatLongDate(profile.createdAt)}.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black">
              <Target className="h-4 w-4 text-primary" />
              Trading Focus
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep this profile tuned for strategy notes, market interests, and community credibility.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Crypto", "Risk", "News", "Signals"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/10 via-background/80 to-cyan-500/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black">
              <Activity className="h-4 w-4 text-primary" />
              Profile Strength
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black text-foreground">{profileCompletion}%</p>
                <p className="text-xs text-muted-foreground">Identity readiness</p>
              </div>
              <div className="h-12 w-20 rounded-xl border border-primary/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.24),transparent_50%),linear-gradient(45deg,transparent_45%,rgba(34,211,238,0.28)_46%,transparent_54%)]" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {identitySignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2 text-xs shadow-sm backdrop-blur"
              >
                <span className={signal.done ? "font-bold text-emerald-500" : "font-bold text-muted-foreground"}>
                  {signal.done ? "Ready" : "Missing"}
                </span>
                <p className="mt-0.5 font-semibold text-foreground">{signal.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs leading-5 text-muted-foreground">
            This identity appears beside comments, favorites, and research activity.
          </div>
        </div>
      </div>
    </section>
  );
}

function NotificationsSection({
  notifications,
  savingSection,
  onChange,
  onSave,
}: {
  notifications: NotificationSettingsForm;
  savingSection: string;
  onChange: (key: keyof NotificationSettingsForm, checked: boolean) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <Panel
      icon={Bell}
      title="Notification Preferences"
      description="Choose exactly which messages, market events, and system alerts should reach you."
      action={
        <Button
          type="button"
          onClick={onSave}
          isLoading={savingSection === "notifications"}
          className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
        >
          <Save className="h-4 w-4" />
          Save Alerts
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {notificationOptions.map((option) => (
          <ToggleRow
            key={option.key}
            label={option.label}
            description={option.description}
            checked={notifications[option.key]}
            onChange={(checked) => onChange(option.key, checked)}
          />
        ))}
      </div>
    </Panel>
  );
}

function ConnectionsSection({
  connection,
  connectionStatus,
  verifiedPlatforms,
  authenticatingPlatform,
  savingSection,
  onConnectionChange,
  onAuthenticatePlatform,
  onSave,
}: {
  connection: ConnectionForm;
  connectionStatus: LiveStatus;
  verifiedPlatforms: string[];
  authenticatingPlatform: string;
  savingSection: string;
  onConnectionChange: Dispatch<SetStateAction<ConnectionForm>>;
  onAuthenticatePlatform: (platformId: string) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <Panel
        icon={Wifi}
        title="Live Data Defaults"
        description="Set the market defaults used by charts, watchlists, news filters, and live monitoring."
        action={
          <Button
            type="button"
            onClick={onSave}
            isLoading={savingSection === "connection"}
            className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
          >
            <Save className="h-4 w-4" />
            Save Connection
          </Button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred market">
              <StyledSelect
                value={connection.preferredMarket}
                onChange={(event) =>
                  onConnectionChange((current) => ({
                    ...current,
                    preferredMarket: event.target.value as PreferredMarket,
                  }))
                }
              >
                {markets.map((market) => (
                  <option key={market.value} value={market.value} className={selectOptionClass}>
                    {market.label}
                  </option>
                ))}
              </StyledSelect>
            </Field>
            <Field label="Color mode">
              <StyledSelect
                value={connection.theme}
                onChange={(event) =>
                  onConnectionChange((current) => ({
                    ...current,
                    theme: event.target.value as ThemeMode,
                  }))
                }
              >
                <option value="dark" className={selectOptionClass}>Dark</option>
                <option value="light" className={selectOptionClass}>Light</option>
                <option value="system" className={selectOptionClass}>System</option>
              </StyledSelect>
            </Field>
            <Field label="Default symbol">
              <input
                value={connection.defaultSymbol}
                onChange={(event) =>
                  onConnectionChange((current) => ({
                    ...current,
                    defaultSymbol: event.target.value.toUpperCase(),
                  }))
                }
                className={inputClass}
                placeholder="BTC/USD"
              />
            </Field>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-300">Chart cadence</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">100ms</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Fixed for responsive live monitoring.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background/65 p-5 shadow-inner">
            <div
              className={cn(
                "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
                connectionStatus === "connected" && "bg-emerald-500/10 text-emerald-500",
                connectionStatus === "disconnected" && "bg-red-500/10 text-red-500",
                (connectionStatus === "connecting" || connectionStatus === "reconnecting") && "bg-blue-500/10 text-blue-500"
              )}
            >
              <Database className="h-7 w-7" />
            </div>
            <p className="text-lg font-black">Live markets {connectionStatusLabel(connectionStatus).toLowerCase()}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The stream status reflects the current browser connection to real-time market data.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        icon={PlugZap}
        title="External Platforms"
        description="Link outside platforms you use for market research, communities, and trade journaling."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {externalPlatforms.map((platform) => {
            const Icon = platform.icon;
            const connected = verifiedPlatforms.includes(platform.authProvider);
            const authenticating = authenticatingPlatform === platform.id;

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => onAuthenticatePlatform(platform.id)}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-300 active:scale-[0.98] [perspective:800px]",
                  connected
                    ? "border-emerald-400/55 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : platform.supported
                      ? "border-border bg-background/70 hover:border-blue-400/45"
                      : "border-border bg-background/55 opacity-80 hover:border-amber-400/45"
                )}
              >
                <div className="relative z-10 transition-transform duration-300 [transform-style:preserve-3d] group-hover:[transform:translateZ(18px)_rotateX(2deg)]">
                  <span className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", platform.tone)}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-black">{platform.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-black",
                        connected
                          ? "bg-emerald-500 text-white"
                          : authenticating
                            ? "bg-blue-500 text-white"
                            : platform.supported
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-300"
                      )}
                    >
                      {connected
                        ? "Connected"
                        : authenticating
                          ? "Authenticating"
                          : platform.supported
                            ? "Authenticate"
                            : "Setup required"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{platform.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function SessionAndAccountPanel({
  devices,
  devicesLoading,
  savingSection,
  onRefreshDevices,
  onRevokeDevice,
  onDisableAccount,
  onDeleteAccount,
}: {
  devices: DeviceState;
  devicesLoading: boolean;
  savingSection: string;
  onRefreshDevices: () => Promise<void>;
  onRevokeDevice: (type: "session" | "trustedDevice", id: string) => Promise<void>;
  onDisableAccount: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  return (
    <Panel
      icon={MonitorUp}
      title="Session And Account Management"
      description="Review active sessions, remove trusted devices, or take account-level actions."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => void onRefreshDevices()}
          isLoading={devicesLoading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <DeviceList
          title="Active Sessions"
          emptyText="No active sessions found."
          icon={MonitorUp}
          rows={devices.sessions.map((session) => ({
            id: session.id,
            title: formatDeviceName(session.userAgent),
            meta: `${session.ipAddress || "Unknown IP"} - expires ${formatCompactDate(session.expiresAt)}`,
            current: session.current,
            type: "session" as const,
          }))}
          savingSection={savingSection}
          onRevokeDevice={onRevokeDevice}
        />
        <DeviceList
          title="Trusted Devices"
          emptyText="No trusted devices saved."
          icon={Smartphone}
          rows={devices.trustedDevices.map((device) => ({
            id: device.id,
            title: device.deviceName || "Trusted device",
            meta: `Trusted until ${formatCompactDate(device.expiresAt)}`,
            current: false,
            type: "trustedDevice" as const,
          }))}
          savingSection={savingSection}
          onRevokeDevice={onRevokeDevice}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black">Disable Account</p>
              <p className="text-xs leading-5 text-muted-foreground">Pause access and end every current session.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDisableAccount()}
            isLoading={savingSection === "disable-account"}
            className="mt-4 border-amber-400/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-300"
          >
            Disable Account
          </Button>
        </div>
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <Trash2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black">Delete Account</p>
              <p className="text-xs leading-5 text-muted-foreground">Delete the account record and end all sessions.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDeleteAccount()}
            isLoading={savingSection === "delete-account"}
            className="mt-4 bg-red-500 text-white hover:bg-red-600"
          >
            Delete Account
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function DeviceList({
  title,
  emptyText,
  icon: Icon,
  rows,
  savingSection,
  onRevokeDevice,
}: {
  title: string;
  emptyText: string;
  icon: ComponentType<{ className?: string }>;
  rows: Array<{
    id: string;
    title: string;
    meta: string;
    current: boolean;
    type: "session" | "trustedDevice";
  }>;
  savingSection: string;
  onRevokeDevice: (type: "session" | "trustedDevice", id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-black">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-border bg-card/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{row.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.meta}</p>
                  {row.current && (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-500">
                      Current session
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={row.current}
                  isLoading={savingSection === `device-${row.id}`}
                  onClick={() => void onRevokeDevice(row.type, row.id)}
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-2xl border border-border bg-background/75 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:[color-scheme:dark]";

const selectOptionClass = "bg-white text-gray-900 dark:bg-[#0b0f12] dark:text-white";

const notificationOptions: Array<{
  key: keyof NotificationSettingsForm;
  label: string;
  description: string;
}> = [
  { key: "inAppEnabled", label: "In-app alerts", description: "Show notifications inside TradX." },
  { key: "emailEnabled", label: "Email alerts", description: "Send important alerts to email." },
  { key: "pushEnabled", label: "Browser push", description: "Allow browser-level notifications." },
  { key: "priceAlerts", label: "Price alerts", description: "Notify when watched prices move." },
  { key: "newsAlerts", label: "News alerts", description: "Notify when relevant news arrives." },
  { key: "adminMessages", label: "Admin messages", description: "Receive platform and account messages." },
  { key: "profileChanges", label: "Profile changes", description: "Confirm identity and security edits." },
  { key: "systemAnnounce", label: "System notices", description: "Receive maintenance and system notices." },
  { key: "marketingEmails", label: "Product emails", description: "Receive optional feature updates." },
];

function Panel({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl shadow-black/10">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-gradient-to-r from-primary/10 via-cyan-500/5 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black tracking-normal">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-sm font-extrabold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function StyledSelect({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          inputClass,
          "appearance-none bg-white/95 pr-10 shadow-sm hover:border-blue-400/45 hover:bg-white dark:bg-[#0b0f12]/95 dark:hover:bg-[#101820]",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4 text-left transition-all hover:border-blue-400/45 hover:bg-muted/70 active:scale-[0.98]"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-extrabold">{label}</span>
        <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors",
          checked ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: LiveStatus;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-sm backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-black",
          tone === "connected" && "text-emerald-500",
          tone === "disconnected" && "text-red-500",
          (tone === "connecting" || tone === "reconnecting") && "text-blue-500"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function AvatarBlock({ avatar, name }: { avatar: string | null; name: string }) {
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-cyan-400 text-xl font-black text-primary-foreground shadow-lg shadow-primary/20"
      style={
        avatar
          ? {
              backgroundImage: `url(${avatar})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {!avatar && (name.trim().charAt(0).toUpperCase() || "U")}
    </span>
  );
}

function normalizeSection(value: string | null): SettingsSection {
  if (value === "notifications" || value === "connections" || value === "profile") return value;
  return "profile";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function connectionStatusLabel(status: LiveStatus) {
  if (status === "connected") return "Connected";
  if (status === "disconnected") return "Offline";
  return "Connecting";
}

function formatCompactDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatLongDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDeviceName(userAgent: string | null) {
  if (!userAgent) return "Unknown device";

  const device = /iPhone/i.test(userAgent)
    ? "iPhone"
    : /iPad/i.test(userAgent)
      ? "iPad"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Macintosh|Mac OS/i.test(userAgent)
          ? "Mac"
          : /Windows/i.test(userAgent)
            ? "Windows"
            : "Device";
  const browser = /Edg/i.test(userAgent)
    ? "Edge"
    : /Firefox/i.test(userAgent)
      ? "Firefox"
      : /Chrome/i.test(userAgent)
        ? "Chrome"
        : /Safari/i.test(userAgent)
          ? "Safari"
          : "Browser";

  return `${device} (${browser})`;
}

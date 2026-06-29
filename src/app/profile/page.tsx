import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { SecuritySettings } from "@/components/profile/security-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CalendarDays, Mail, MapPin, Shield, Sparkles, Target, User } from "lucide-react";

export const metadata = { title: "Profile Management" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      avatar: true,
      bio: true,
      dateOfBirth: true,
      country: true,
      timezone: true,
      preferredLanguage: true,
      reputation: true,
      contributionCount: true,
      createdAt: true,
      emailVerified: true,
      twoFactorEnabled: true,
    },
  });

  if (!fullUser) redirect("/login");

  const joined = fullUser.createdAt.toISOString().slice(0, 10);
  const completionChecks = [
    Boolean(fullUser.avatar),
    Boolean(fullUser.bio),
    Boolean(fullUser.country),
    Boolean(fullUser.emailVerified),
    Boolean(fullUser.twoFactorEnabled),
  ];
  const profileCompletion = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100
  );
  const identitySignals = [
    { label: "Avatar", done: Boolean(fullUser.avatar) },
    { label: "Bio", done: Boolean(fullUser.bio) },
    { label: "Location", done: Boolean(fullUser.country) },
    { label: "Verified", done: Boolean(fullUser.emailVerified) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-2xl shadow-black/10 dark:bg-[#101214]/95">
        <div className="relative p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_34rem)]" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-cyan-400 text-3xl font-bold text-primary-foreground shadow-xl shadow-primary/20">
                {fullUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fullUser.avatar} alt={fullUser.name} className="h-full w-full object-cover" />
                ) : (
                  fullUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{fullUser.role}</Badge>
                  <Badge variant={fullUser.emailVerified ? "success" : "warning"}>
                    {fullUser.emailVerified ? "Verified" : "Email pending"}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold tracking-normal">{fullUser.name}</h1>
                <p className="text-sm text-muted-foreground">@{fullUser.username || "user"}</p>
              </div>
            </div>
            <div className="grid gap-4 pt-2 text-sm text-muted-foreground sm:grid-cols-3 md:pt-8 md:text-right">
              <span className="flex items-center gap-2 md:justify-end">
                <Mail className="h-4 w-4" />
                {fullUser.email}
              </span>
              <span className="flex items-center gap-2 md:justify-end">
                <CalendarDays className="h-4 w-4" />
                Joined {joined}
              </span>
              <span className="flex items-center gap-2 md:justify-end">
                <MapPin className="h-4 w-4" />
                {fullUser.country || "No location"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-full overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/10 dark:bg-[#101214]/95 lg:col-span-1">
          <CardHeader className="border-b border-border/70 bg-white/95 p-6 pb-5 dark:bg-[#101214]">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Trader Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-5 p-5 pt-6">
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Bio
              </div>
              <p className="text-sm text-muted-foreground">
                {fullUser.bio || "No bio yet. Add a short trading profile so others know your focus."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-2xl font-bold text-primary">{fullUser.reputation}</p>
                <p className="text-xs text-muted-foreground">Reputation</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-2xl font-bold text-accent">{fullUser.contributionCount}</p>
                <p className="text-xs text-muted-foreground">Contributions</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Account Protection
              </div>
              Two-factor authentication is {fullUser.twoFactorEnabled ? "enabled" : "disabled"}.
            </div>
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" />
                Trading Focus
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Keep your profile tuned for strategy notes, asset interests, and community credibility.
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
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background/80 to-cyan-500/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                Profile Strength
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-foreground">{profileCompletion}%</p>
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
            <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/85 to-cyan-500/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.10)] transition-transform duration-300 hover:-translate-y-0.5 dark:shadow-[0_18px_55px_rgba(0,0,0,0.30)]">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-cyan-400 text-lg font-black text-primary-foreground shadow-xl shadow-primary/20"
                  style={
                    fullUser.avatar
                      ? {
                          backgroundImage: `url(${fullUser.avatar})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!fullUser.avatar && fullUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{fullUser.name}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">@{fullUser.username || "user"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
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
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs leading-5 text-muted-foreground">
                This identity appears beside comments, favorites, and research activity.
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileEditor
          user={{
            name: fullUser.name,
            email: fullUser.email,
            username: fullUser.username,
            avatar: fullUser.avatar,
            bio: fullUser.bio,
            dateOfBirth: fullUser.dateOfBirth?.toISOString() ?? null,
            location: fullUser.country,
          }}
        />
      </div>

      <div className="mt-6">
        <SecuritySettings
          email={fullUser.email}
          emailVerified={Boolean(fullUser.emailVerified)}
          twoFactorEnabled={fullUser.twoFactorEnabled}
        />
      </div>
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Clock } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 neon-glow">Profile Management</h1>
        <p className="text-muted-foreground">Manage your personal information and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="dash-panel lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold">
                {fullUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fullUser.avatar} alt={fullUser.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  fullUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold">{fullUser.name}</p>
                <p className="text-sm text-muted-foreground">@{fullUser.username || "user"}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{fullUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{fullUser.role}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Joined {new Date(fullUser.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{fullUser.reputation}</p>
                  <p className="text-xs text-muted-foreground">Reputation</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">{fullUser.contributionCount}</p>
                  <p className="text-xs text-muted-foreground">Contributions</p>
                </div>
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
          }}
        />
      </div>

      {/* Security Section */}
      <Card className="dash-panel mt-6">
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
              <div>
                <p className="font-medium">Email Verification</p>
                <p className="text-sm text-muted-foreground">
                  {fullUser.emailVerified ? "Verified" : "Not verified"}
                </p>
              </div>
              <Badge variant={fullUser.emailVerified ? "success" : "warning"}>
                {fullUser.emailVerified ? "Verified" : "Pending"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  {fullUser.twoFactorEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <Badge variant={fullUser.twoFactorEnabled ? "success" : "outline"}>
                {fullUser.twoFactorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

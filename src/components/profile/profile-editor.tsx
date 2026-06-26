"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { secureFetch } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

interface ProfileEditorUser {
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  dateOfBirth: string | null;
}

export function ProfileEditor({ user }: { user: ProfileEditorUser }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    username: user.username ?? "",
    avatar: user.avatar ?? "",
    bio: user.bio ?? "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    currentPassword: "",
    newPassword: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    try {
      const response = await secureFetch("/api/user", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          avatar: form.avatar,
          bio: form.bio,
          dateOfBirth: form.dateOfBirth,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const json = await response.json();

      if (!json.success) {
        setError(json.error ?? "Could not save profile");
        return;
      }

      setForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
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
    <Card className="dash-panel lg:col-span-2">
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <Input
            label="Avatar URL"
            value={form.avatar}
            onChange={(event) => update("avatar", event.target.value)}
            placeholder="https://example.com/avatar.png"
          />

          <Input
            label="Email"
            value={form.email}
            disabled
            readOnly
            className="opacity-75"
          />

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <UserRound className="h-4 w-4" />
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
              placeholder="Tell us about yourself"
              className="min-h-[92px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
            />
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <Globe className="h-4 w-4" />
                Email is protected
              </div>
              Email address changes are disabled for account safety.
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
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

          {error && <p className="text-sm text-destructive">{error}</p>}
          {status && <p className="text-sm text-emerald-500">{status}</p>}

          <Button type="submit" className="w-full" isLoading={saving}>
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

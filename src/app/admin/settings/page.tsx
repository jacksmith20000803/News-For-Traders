import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function AdminSettingsPage() {
  await requireAdminPage();

  const [settings, flags] = await Promise.all([
    db.siteSetting.findMany(),
    db.featureFlag.findMany(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom settings configured.</p>
          ) : (
            settings.map((s) => (
              <div key={s.key} className="flex justify-between text-sm">
                <span className="font-medium">{s.key}</span>
                <span className="text-muted-foreground">{s.value}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feature flags configured.</p>
          ) : (
            flags.map((f) => (
              <div key={f.key} className="flex justify-between items-center text-sm">
                <span className="font-medium">{f.key}</span>
                <Badge variant={f.enabled ? "success" : "outline"}>
                  {f.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

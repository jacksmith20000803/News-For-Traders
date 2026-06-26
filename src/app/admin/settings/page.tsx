import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";

export default async function AdminSettingsPage() {
  const adminUser = await requireAdminPage();

  // Log admin settings page access for security audit
  await db.auditLog.create({
    data: {
      adminId: adminUser.id,
      action: "SETTINGS_UPDATE",
      ipAddress: "SYSTEM",
      metadata: { action: "SETTINGS_PAGE_VIEW" },
    },
  });

  const [settings, flags, bgImage] = await Promise.all([
    db.siteSetting.findMany(),
    db.featureFlag.findMany(),
    db.siteSetting.findUnique({ where: { key: "platform_background_image" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Platform Background Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Background Image URL</label>
            <Input
              defaultValue={bgImage?.value || ""}
              placeholder="https://example.com/image.jpg"
              id="bgImageUrl"
            />
          </div>
          {bgImage?.value && (
            <div>
              <label className="block text-sm font-medium mb-2">Current Background</label>
              <div className="w-full h-32 rounded-lg overflow-hidden border border-border">
                <Image
                  src={bgImage.value}
                  alt="Platform background"
                  width={800}
                  height={128}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}
          <Button
            onClick={() => {
              const input = document.getElementById('bgImageUrl') as HTMLInputElement;
              const url = input?.value;
              if (url) {
                fetch('/api/admin/settings/background', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageUrl: url })
                }).then(() => window.location.reload());
              }
            }}
          >
            Update Background
          </Button>
        </CardContent>
      </Card>

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

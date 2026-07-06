import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminBackgroundSettingsForm } from "@/components/admin/admin-background-settings-form";
import { AdminDownloadReportSettingsForm } from "@/components/admin/admin-download-report-settings-form";
import { AdminEmailKeySettings } from "@/components/admin/admin-email-key-settings";
import { AdminTradingBotDownloadSettingsForm } from "@/components/admin/admin-trading-bot-download-settings-form";
import { TRADING_BOT_LOCAL_DOWNLOAD_URL } from "@/lib/download/trading-bot-links";
import { getDownloadReportTimezone } from "@/lib/download/daily-report";
import { getTradingBotDownloadConfig } from "@/lib/download/trading-bot-settings";
import Link from "next/link";

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

  const [settings, flags, bgImage, tradingBotDownloadConfig, downloadReportTimezone] = await Promise.all([
    db.siteSetting.findMany(),
    db.featureFlag.findMany(),
    db.siteSetting.findUnique({ where: { key: "platform_background_image" } }),
    getTradingBotDownloadConfig(),
    getDownloadReportTimezone(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Platform Background Image</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminBackgroundSettingsForm initialImageUrl={bgImage?.value || ""} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trading Bot Download Link</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTradingBotDownloadSettingsForm
            initialConfig={tradingBotDownloadConfig}
            fallbackUrl={TRADING_BOT_LOCAL_DOWNLOAD_URL}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Daily Report Timezone</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDownloadReportSettingsForm initialTimezone={downloadReportTimezone} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email Verification API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminEmailKeySettings />
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

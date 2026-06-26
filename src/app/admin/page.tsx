import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Newspaper, MessageSquare, AlertTriangle, Shield, Bot } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const adminUser = await requireAdminPage();

  // Log admin dashboard access for security audit
  await db.auditLog.create({
    data: {
      adminId: adminUser.id,
      action: "SETTINGS_UPDATE",
      ipAddress: "SYSTEM",
      metadata: { action: "DASHBOARD_VIEW" },
    },
  });

  const [userCount, newToday, newsCount, reportCount, unviewedRegs, newFeedback, recentAudit] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({
        where: { deletedAt: null, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      db.news.count(),
      db.report.count({ where: { status: "PENDING" } }),
      db.registrationAudit.count({ where: { adminViewed: false } }),
      db.feedbackSubmission.count({ where: { status: "NEW" } }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { admin: { select: { name: true } } },
      }),
    ]);

  const stats = [
    { label: "Total Users", value: userCount, icon: Users, href: "/admin/users" },
    { label: "New Today", value: newToday, icon: Users, href: "/admin/registrations" },
    { label: "Unviewed Registrations", value: unviewedRegs, icon: Users, href: "/admin/registrations" },
    { label: "News Items", value: newsCount, icon: Newspaper, href: "/admin/news" },
    { label: "Feedback Inbox", value: newFeedback, icon: MessageSquare, href: "/admin/feedback" },
    { label: "AI Assistant", value: "Puter", icon: Bot, href: "/admin/ai" },
    { label: "Pending Reports", value: reportCount, icon: AlertTriangle, href: "/admin/moderation" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform management and moderation</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Admin Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit logs yet.</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0"
                  >
                    <div>
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="ml-2 text-muted-foreground">by {log.admin.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/admin/users", label: "User Management" },
              { href: "/admin/content", label: "Content Management" },
              { href: "/admin/news", label: "News Management" },
              { href: "/admin/moderation", label: "Community Moderation" },
              { href: "/admin/audit", label: "Audit Logs" },
              { href: "/admin/settings", label: "System Settings" },
              { href: "/admin/analytics", label: "Analytics" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

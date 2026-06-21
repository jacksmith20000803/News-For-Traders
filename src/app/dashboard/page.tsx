import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative, getInitials } from "@/lib/utils";
import {
  Bookmark,
  Bell,
  Settings,
  Activity,
  TrendingUp,
  Eye,
  Briefcase,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [bookmarks, notifications, watchlists, alerts, portfolio, badges] = await Promise.all([
    db.bookmark.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.watchlist.count({ where: { userId: user.id } }),
    db.priceAlert.count({ where: { userId: user.id, isActive: true } }),
    db.portfolio.findFirst({
      where: { userId: user.id },
      include: { _count: { select: { positions: true } } },
    }),
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
    }),
  ]);

  const navItems = [
    { href: "/dashboard/bookmarks", label: "Saved Items", icon: Bookmark, count: bookmarks },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell, count: notifications },
    { href: "/dashboard/watchlists", label: "Watchlists", icon: Eye, count: watchlists },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: Briefcase, count: portfolio?._count.positions },
    { href: "/dashboard/alerts", label: "Alerts", icon: Bell, count: alerts },
    { href: "/dashboard/activity", label: "Activity History", icon: Activity },
    { href: "/dashboard/settings", label: "Account Settings", icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="primary">
              <TrendingUp className="h-3 w-3 mr-1" />
              Rep {user.reputation}
            </Badge>
            <Badge variant="outline">{user.contributionCount} contributions</Badge>
            <Badge variant="outline">Joined {formatRelative(user.createdAt)}</Badge>
            {!user.emailVerified && (
              <Badge variant="warning">Email unverified</Badge>
            )}
          </div>
          {badges.length > 0 && (
            <div className="flex gap-2 mt-3">
              {badges.map((ub) => (
                <span key={ub.badgeId} title={ub.badge.description}>
                  <Badge variant="success">{ub.badge.name}</Badge>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navItems.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/30 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">{label}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {count !== undefined && (
                  <p className="text-2xl font-bold">{count}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

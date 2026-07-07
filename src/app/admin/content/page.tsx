import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminCommunityManagement } from "@/components/admin/admin-community-management";
import { AdminCommunityMediaManager } from "@/components/admin/admin-community-media-manager";
import Link from "next/link";

export default async function AdminContentPage() {
  await requireAdminPage();

  const [pendingArticles, reports, pendingCommunities] = await Promise.all([
    db.article.findMany({
      where: { status: "PENDING" },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.report.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.tradeCommunity.findMany({
      where: { status: "PENDING" },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            country: true,
          },
        },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content & Moderation</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Community Requests ({pendingCommunities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminCommunityManagement
              initialItems={pendingCommunities.map((community) => ({
                id: community.id,
                name: community.name,
                slug: community.slug,
                topic: community.topic,
                rules: community.rules,
                avatarUrl: community.avatarUrl,
                badgeUrl: community.badgeUrl,
                status: community.status,
                rejectionReason: community.rejectionReason,
                owner: community.owner,
                approvedBy: community.approvedBy,
                memberCount: community._count.members,
                messageCount: community._count.messages,
                createdAt: community.createdAt.toISOString(),
                approvedAt: community.approvedAt?.toISOString() ?? null,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Community Media Library</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminCommunityMediaManager />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Articles ({pendingArticles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending content.</p>
            ) : (
              pendingArticles.map((a) => (
                <div key={a.id} className="border-b border-border pb-3">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">by {a.author.name}</p>
                  <Badge variant="warning" className="mt-1">Pending Review</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Reports ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending reports.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="border-b border-border pb-3">
                  <Badge variant="outline">{r.targetType}</Badge>
                  <p className="text-sm mt-1">{r.reason}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";
import Link from "next/link";
import { AdminUserActions } from "@/components/admin/admin-user-actions";

export const metadata = { title: "User Management" };

export default async function AdminUsersPage() {
  await requireAdminPage();

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      reputation: true,
      isSuspended: true,
      isBanned: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Rep</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{user.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{ROLE_LABELS[user.role as Role]}</Badge>
                    </td>
                    <td className="py-3 pr-4">{user.reputation}</td>
                    <td className="py-3 pr-4">
                      {user.isBanned ? (
                        <Badge variant="danger">Banned</Badge>
                      ) : user.isSuspended ? (
                        <Badge variant="warning">Suspended</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <AdminUserActions
                        userId={user.id}
                        role={user.role as Role}
                        isSuspended={user.isSuspended}
                        isBanned={user.isBanned}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

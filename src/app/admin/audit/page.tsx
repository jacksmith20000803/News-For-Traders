import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export default async function AdminAuditPage() {
  await requireAdminPage();

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { admin: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">← Back</Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-4">Action</th>
                  <th className="p-4">Admin</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">IP</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50">
                    <td className="p-4"><Badge variant="outline">{log.action}</Badge></td>
                    <td className="p-4">{log.admin.name}</td>
                    <td className="p-4 text-muted-foreground">
                      {log.targetType ? `${log.targetType}:${log.targetId?.slice(0, 8)}` : "—"}
                    </td>
                    <td className="p-4 text-muted-foreground">{log.ipAddress ?? "—"}</td>
                    <td className="p-4 text-muted-foreground">{formatRelative(log.createdAt)}</td>
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

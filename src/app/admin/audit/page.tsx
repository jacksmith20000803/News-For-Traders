import Link from "next/link";
import { AdminAuditManagement } from "@/components/admin/admin-audit-management";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";

export default async function AdminAuditPage() {
  await requireAdminPage();

  const [logs, totalLogs] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { admin: { select: { name: true, email: true } } },
    }),
    db.auditLog.count(),
  ]);

  const initialData = {
    items: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      page: 1,
      limit: 20,
      total: totalLogs,
      totalPages: Math.max(1, Math.ceil(totalLogs / 20)),
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect admin actions, filter records, and clean up unnecessary log data.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          Back
        </Link>
      </div>

      <AdminAuditManagement initialData={initialData} />
    </div>
  );
}

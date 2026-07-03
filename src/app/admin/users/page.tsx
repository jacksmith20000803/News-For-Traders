import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { AdminDownloadReportsPanel } from "@/components/admin/admin-download-reports-panel";

export const metadata = { title: "User Management" };

export default async function AdminUsersPage() {
  const adminUser = await requireAdminPage();

  await db.auditLog.create({
    data: {
      adminId: adminUser.id,
      action: "USER_PROFILE_UPDATE",
      ipAddress: "SYSTEM",
      metadata: { action: "USERS_PAGE_VIEW" },
    },
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Review registered users and visitors, then open detail pages for activity and account controls.
          </p>
        </div>
        <Link href="/admin" className="w-fit rounded-lg border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-muted">
          Back to dashboard
        </Link>
      </div>

      <AdminDownloadReportsPanel />
      <AdminUsersTable />
    </div>
  );
}

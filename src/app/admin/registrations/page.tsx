import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AdminRegistrationsManagement } from "@/components/admin/admin-registrations-management";

export const metadata = { title: "Registration Analytics" };

export default async function AdminRegistrationsPage() {
  await requireAdminPage();

  const limit = 12;
  const [items, total, unviewed] = await Promise.all([
    db.registrationAudit.findMany({
      orderBy: { registeredAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, username: true, avatar: true, role: true } } },
    }),
    db.registrationAudit.count(),
    db.registrationAudit.count({ where: { adminViewed: false } }),
  ]);

  const serializedItems = items.map((item) => ({
    ...item,
    registeredAt: item.registeredAt.toISOString(),
    ipRiskCheckedAt: item.ipRiskCheckedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registration Analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {total} total registrations · {unviewed} unviewed registrations.
          </p>
        </div>
        <Link href="/admin" className="inline-flex rounded-2xl border border-border bg-card/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground">
          Back to Dashboard
        </Link>
      </div>

      <AdminRegistrationsManagement
        initialData={{
          items: serializedItems,
          pagination: {
            page: 1,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }}
      />
    </div>
  );
}

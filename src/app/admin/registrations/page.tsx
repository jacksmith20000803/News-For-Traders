import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Registrations" };

export default async function AdminRegistrationsPage() {
  await requireAdminPage();

  const registrations = await db.registrationAudit.findMany({
    orderBy: { registeredAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  const unviewed = registrations.filter((r) => !r.adminViewed).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registration Analytics</h1>
          <p className="text-muted-foreground">{registrations.length} total · {unviewed} unviewed</p>
        </div>
        <Link href="/admin" className="text-sm text-emerald-400 hover:underline">← Dashboard</Link>
      </div>

      <div className="dash-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Country</th>
              <th className="p-3">Device</th>
              <th className="p-3">Browser / OS</th>
              <th className="p-3">IP</th>
              <th className="p-3">Registered</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {!r.adminViewed && <Badge variant="warning">New</Badge>}
                    <div>
                      <p className="font-medium">{r.user.name}</p>
                      <p className="text-xs text-muted-foreground">{r.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{r.country ?? "—"}</td>
                <td className="p-3">{r.deviceType ?? "—"}</td>
                <td className="p-3">{r.browser} / {r.os}</td>
                <td className="p-3 font-mono text-xs">{r.ipAddress ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{formatRelative(r.registeredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

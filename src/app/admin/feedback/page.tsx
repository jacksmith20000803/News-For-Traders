import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Feedback Inbox" };

export default async function AdminFeedbackPage() {
  await requireAdminPage();

  const submissions = await db.feedbackSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feedback Inbox</h1>
        <Link href="/admin" className="text-sm text-emerald-400 hover:underline">← Dashboard</Link>
      </div>

      <div className="space-y-3">
        {submissions.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No submissions yet</p>
        ) : (
          submissions.map((s) => (
            <div key={s.id} className="dash-panel rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline">{s.type}</Badge>
                <Badge variant={s.status === "NEW" ? "warning" : "outline"}>{s.status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatRelative(s.createdAt)}</span>
              </div>
              <p className="font-medium">{s.subject}</p>
              <p className="text-xs text-muted-foreground mb-2">{s.name} · {s.email}</p>
              <p className="text-sm text-muted-foreground">{s.message}</p>
              {s.adminReply && (
                <p className="mt-2 text-sm border-t border-white/5 pt-2 text-emerald-400">
                  Reply: {s.adminReply}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
